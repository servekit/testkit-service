# testkit-service P4（消息域）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 message-service 的 13 个用户态 RPC（14 个去掉 Ping）聚合进 testkit BFF 的 `TestKitService`，落地自包含 proto + sender-from-config 映射层 + swagger 前端联动，产出「发送邮件/短信 + 邮件记录 + 短信记录 + 统计 + 发送方/区域下拉」前端页。

**Architecture:** testkit 是唯一信任边界。SendEmail/SendSMS 的 `sender_id`（下游语义=「调用方业务服务标识」，如 `user-service`/`pay-service`，**非用户 id**）**不出现在 testkit request 里**——由 BFF 从 `cfg.Message.SenderID`（默认 `testkit-service`）注入。Get/GetEmail/GetSMS 的 `id` 是**操作目标**（资源 ID），保留。List/Stats 各过滤条件保留（vendor/scene/status/time/target/region/phone），但 `sender_id` 过滤字段去掉（testkit 部署单发送方，过滤无意义且暴露越权可能）。枚举在 testkit proto 重新定义（镜像 message-service 同名同号），映射整型直转。嵌套 message（EmailAddress、EmailAttachment、VendorStats）在 testkit 重新定义。下游 `xerr.Error` 透传，不吞错。映射层 `internal/service/message/message.go` 是**唯一同时 import `testkitv1` 与 `messagev1`** 的文件。

**Tech Stack:** Go 1.26 + go-common（grpcx/dbx/redisx/xerr）+ buf v2 + grpc-gateway；message in-process embed（P1 thirdcall `mode=module`，client = `*message.Handler`）；前端 Ant Design Pro v6（React 19 + antd 6 + Umi Max 4 + ProComponents），请求层 100% 由 `npm run openapi` 从 testkit.swagger.json 生成。

---

## 关键决策与映射约定（实现前必读）

1. **`sender_id` curation —— 从 config 注入，不从 ctx user_id（核心决策，需对照 spec §3.2 规则 1）**
   - 下游 `SendEmailRequest.sender_id` / `SendSMSRequest.sender_id` 的语义在 proto 里写得很明确：「identifies the **calling business service** (e.g. "user-service", "pay-service"). Required. **NOT the end-user/admin id** — the caller must record that in its own audit trail.」即它是一个**服务标签**，不是用户身份。
   - spec §3.2 规则 1 要求去掉「调用方身份」字段并由 BFF 注入。`sender_id` 正是「调用方身份」（从 testkit 角度看，testkit 就是 message-service 的调用方业务服务）。
   - **决策**：`sender_id` **从 testkit request 去掉**，BFF 从 `cfg.Message.SenderID`（默认 `"testkit-service"`，`default:` tag 兜底）注入到下游 Send 请求。**不**用 ctx 里的 `user_id`。
   - **为什么不从 ctx user_id**：
     1. 与下游文档冲突——下游明确说 sender_id 不是 user id；把 `user_id` 塞进一个标注「NOT the end-user/admin id」的字段是语义误用。
     2. 下游幂等键按 `(sender_id, idempotency_key)` 在 Redis 去重（`msg:idem:{channel}:{senderID}:{key}`）。若 sender_id 随用户变化，幂等作用域就变成 per-user（同一逻辑发送，不同用户各占一个幂等位），通常不是 BFF 想要的全局去重语义。
     3. 字段尺寸按短服务标签设计，不适合放 `user:42` 之类的标识。
   - **per-user 审计**留给 testkit 自有审计表（未来工作，非 P4 范围）——下游既已声明「caller must record that in its own audit trail」，testkit 承担该职责即可，不必扭曲下游字段。
   - 若某部署确实想区分来源（如多入口），改 `cfg.Message.SenderID` 即可（如 `"testkit-ops"` / `"testkit-api"`）。

2. **List/Stats 的 `sender_id` 过滤字段也去掉（不注入、不暴露）**
   - 下游 ListEmails/ListSMS/ListByCursor/Stats 的 request 各有一个 `sender_id` 可选过滤字段。testkit **两边都不做**：既不在 testkit request 暴露（防止前端伪造过滤），也不在映射时自动注入（testkit 部署单一发送方，按自身 sender_id 过滤等于「只看 testkit 发的」，会隐藏 user-service 直发的验证码邮件等共享 DB 里的合法记录——ops 控制台需要全可见）。
   - 映射层对 List/Stats 的 `toMessage<Method>Request` 不设 `SenderId` 字段 → 下游按「无 sender 过滤」返回全部记录。对 ops 控制台语义正确。
   - **这是 spec §3.2「BFF 按 ctx user scope」泛式在 message 域的合理偏离**——message-service 根本没有 user_id 概念，sender_id 是服务标签非 ownership；按记录全可见（admin 视角）更贴合 ops 用例。决策与理由记录于此。

3. **`Get{id}` 的资源 ID 保留**：GetEmail/GetSMS 的 `id` 是「操作目标」（spec §3.2 规则 1 的「操作谁/什么」），**保留**在 testkit request（前端指定要看哪条记录）。

4. **枚举镜像 + int 直转**：在 testkit proto 重新定义 7 个枚举（MessageStatus、EmailVendor、SmsVendor、EmailScene、SmsScene、SortField、SortDirection），名称+编号与 `message.v1` **逐字一致**。映射用 `messagev1.EmailVendor(r.GetVendor())` 整型直转，无需查表。

5. **嵌套 message 在 testkit 重新定义**：EmailAddress、EmailAttachment、EmailVendorStats、SmsVendorStats 均在 testkit proto 自定义（EmailAddress 同字段；EmailAttachment 去掉下游的 `reserved` 占位、字段号重排干净；VendorStats 同结构）。映射层逐字段翻译。

6. **SendResponse 的 oneof 拆成两个可选字段**：下游 `SendResponse.vendor` 是 `oneof{email_vendor, sms_vendor}`。openapiv2 把 oneof 编成带 discriminator 的 union，前端 TS 类型较绕。testkit 按 spec §3.2 规则 4（为前端聚合/改名）拆成 `email_vendor` + `sms_vendor` 两个可选字段（同一时刻只有一个非 0）；映射层 switch oneof case 填对应字段。

7. **响应裁剪策略**：P4 是 ops 控制台，admin 要看完整记录便于排障——EmailRecord/SMSRecord **全字段保留**（含 sender_id 只读回显、attempts、updated_at）。P4 的「裁剪」集中在 request 侧（去 sender_id），响应侧保持高保真。

8. **转换器命名（沿用 P3 约定）**：`toMessage<Method>Request`（testkit→message 请求）、`toTestkit<Entity>`（message→testkit 实体/响应）。Send 类 converter 签名带 `senderID string` 参数（注入配置值）；Get/List/Stats 类不带额外参数（纯透传/直转）。

9. **下游 gen 只被两处 import**（spec §3.4）：`internal/thirdcall/message`（client 接线，P1 已建）+ `internal/service/message`（本域映射）。`pkg/handler`、testkit proto、前端对 `messagev1` 完全无感。

10. **service.go 字段命名 / import 别名（必读，避免与 P1 冲突）**：P1 Task 8 已在 `Service` struct 占用 `message *message.Handler`（thirdcall handler，import path `internal/thirdcall/message`）。本域 package 同名 `message`（`internal/service/message`），两者 import 默认名撞车。**解法**：thirdcall 字段保持不动（`message *message.Handler`，不破坏 P1-P3）；本域 import 加别名 `msgcore "github.com/servekit/testkit-service/internal/service/message"`，字段名 `messageSvc *msgcore.Service`，facade 方法 `func (s *Service) Message() *msgcore.Service`。handler 仍写 `h.svc.Message().SendEmail(...)`，调用侧无感。（若 P2/P3 已采用「thirdcall 字段加 `Hdl` 后缀」的统一约定，则按 P3 实际代码风格对齐：thirdcall 改 `messageHdl`、本域占 `message *message.Service`。两种都行，P4 Task 10 给出前者实现并在注释里说明可替换。）

11. **stub 测试技巧（沿用 P3）**：`messagev1.UnimplementedMessageServiceServer` 实现了全部 14 个 RPC（返回 unimplemented）。测试 stub 嵌入它即可满足本域 `MessageClient` 接口，**只需覆写被测方法**——stub 里断言 `req.GetSenderId() == cfg 注入值`，验证 sender 注入正确。

---

## File Structure

P4 涉及的文件（创建/修改）：

```
testkit-service/
├── api/proto/testkit/v1/testkit.proto          # 追加 message 枚举 + 消息 + 13 RPC [改]
├── api/swagger/testkit/v1/testkit.swagger.json # make proto 重生 [改]
├── gen/testkit/v1/                             # make proto 重生 [改]
├── internal/service/
│   ├── service.go                              # 加 messageSvc *msgcore.Service + New + Message() facade [改]
│   └── message/
│       ├── message.go                          # Service + 13 方法 + converters（唯一 import messagev1） [建]
│       └── message_test.go                     # stub client（embed Unimplemented）+ 映射测试 [建]
├── pkg/
│   ├── config/config.go                        # 加 MessageConfig{SenderID} + config_test 断言默认值 [改]
│   ├── handler/testkit.go                      # 13 个 RPC 薄壳一行委托 [改]
│   └── xcodes/message.go                       # message 域 testkit 错误码（ErrSenderNotConfigured 防御） [建]
├── config.example.yaml                         # 加 message.sender_id 段 [改]
└── web/
    ├── config/routes.ts                        # 加 /message/* 路由 [改]
    └── src/pages/Message/
        ├── SendEmail/                          # ProForm 发邮件（收件人/附件/scene/vendor） [建]
        ├── SendSMS/                            # ProForm 发短信（region/phone/content|template） [建]
        ├── Emails/                             # 邮件记录 ProTable（offset + cursor 切换 + stats modal + senders 下拉） [建]
        └── SMS/                                # 短信记录 ProTable（offset + stats modal + regions/senders 下拉） [建]
```

**职责边界**：`internal/service/message`（业务方法 + 映射同文件，converters 在 `// --- converters ---` 下）；`pkg/handler`（只见 testkitv1，一行委托）；`pkg/xcodes/message.go`（testkit 自身错误码，下游 xerr 透传不归这管）；`pkg/config`（聚合 message.sender_id）。

---

## Task 1: proto 自定义 message 枚举 + 消息 + 13 RPC + make proto

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`

- [ ] **Step 1: 在 proto 文件的消息/枚举区（P3 storage 之后）追加 message 枚举 + 嵌套实体**

在 `api/proto/testkit/v1/testkit.proto` 追加（保持 P1/P2/P3 已有内容不动）。枚举编号与 `message.v1` 逐字一致：

```proto
// ---- Message enums (P4) ----
// 镜像 message-service (api/proto/message/v1/message.proto) 同名同号，
// testkit↔messagev1 转换即整型直转：messagev1.EmailScene(r.GetScene())。
// 在 testkit 重新定义（非 import）以保持 proto 自包含（v2 §3.1），并给前端真实 enum 类型。

enum MessageStatus {
  MESSAGE_STATUS_UNSPECIFIED = 0;
  MESSAGE_STATUS_PENDING = 1;
  MESSAGE_STATUS_SENT = 2;
  MESSAGE_STATUS_FAILED = 3;
}

enum EmailVendor {
  EMAIL_VENDOR_UNSPECIFIED = 0;
  EMAIL_VENDOR_ALIYUN = 1;
  EMAIL_VENDOR_TENCENT = 2;
  EMAIL_VENDOR_NETEASE = 3;
}

enum SmsVendor {
  SMS_VENDOR_UNSPECIFIED = 0;
  SMS_VENDOR_ALIYUN = 1;
  SMS_VENDOR_TENCENT = 2;
  SMS_VENDOR_VOLCENGINE = 3;
  SMS_VENDOR_BYTEPLUS = 4;
  SMS_VENDOR_HUAWEI = 5;
}

enum EmailScene {
  EMAIL_SCENE_UNSPECIFIED = 0;
  EMAIL_SCENE_LOGIN_CODE = 1;
  EMAIL_SCENE_FORGOT_PASSWORD = 2;
  EMAIL_SCENE_REGISTER = 3;
  EMAIL_SCENE_CHANGE_PASSWORD = 4;
  EMAIL_SCENE_BIND_ACCOUNT = 5;
  EMAIL_SCENE_NOTIFICATION = 6;
  EMAIL_SCENE_VERIFY_EMAIL = 7;
}

enum SmsScene {
  SMS_SCENE_UNSPECIFIED = 0;
  SMS_SCENE_LOGIN_CODE = 1;
  SMS_SCENE_FORGOT_PASSWORD = 2;
  SMS_SCENE_REGISTER = 3;
  SMS_SCENE_CHANGE_PASSWORD = 4;
  SMS_SCENE_BIND_ACCOUNT = 5;
  SMS_SCENE_VERIFY_PHONE = 6;
}

enum SortField {
  SORT_FIELD_UNSPECIFIED = 0;
  SORT_FIELD_CREATED_AT = 1;
}

enum SortDirection {
  SORT_DIRECTION_UNSPECIFIED = 0;
  SORT_DIRECTION_ASC = 1;
  SORT_DIRECTION_DESC = 2;
}

// ---- Message shared entities (P4) ----
// 嵌套 message 在 testkit 重新定义（spec §3.2 规则 5 + 决策 5）。

// EmailAddress 镜像下游同名 message（email + display_name）。
message EmailAddress {
  string email = 1 [(buf.validate.field).string.email = true];
  string display_name = 2;
}

// EmailAttachment 去掉下游的 reserved 占位、字段号重排干净。
// url/content XOR（下游校验）；DB 只存元数据（content 不持久化，record 回显时为空）。
message EmailAttachment {
  string filename = 1 [(buf.validate.field).string.min_len = 1];
  string url = 2;
  bytes content = 3;
  bool inline = 4;
  string mime_type = 5;
  int64 size_bytes = 6;
}

// EmailVendorStats / SmsVendorStats 镜像下游。
message EmailVendorStats {
  EmailVendor vendor = 1;
  int64 total = 2;
  int64 sent = 3;
  int64 failed = 4;
}
message SmsVendorStats {
  SmsVendor vendor = 1;
  int64 total = 2;
  int64 sent = 3;
  int64 failed = 4;
}
```

- [ ] **Step 2: 追加 Send / Record / Get / List / Stats / Lookup 的 curated message**

继续追加。Send 类已去 sender_id（决策 1）；List/Stats 已去 sender_id 过滤（决策 2）：

```proto
// ---- Send ----

message SendEmailRequest {
  repeated EmailAddress to = 1 [(buf.validate.field).repeated.min_items = 1];
  repeated EmailAddress cc = 2;
  repeated EmailAddress bcc = 3;
  string subject = 4 [(buf.validate.field).string.min_len = 1];
  string body = 5;
  string html_body = 6;
  EmailAddress reply_to = 7;
  EmailVendor vendor = 8;
  string account = 9;
  string template_id = 10;
  map<string, string> template_params = 11;
  EmailScene scene = 12;
  // sender_id NOT exposed — BFF fills from cfg.Message.SenderID (decision 1).
  string idempotency_key = 13 [(buf.validate.field).string.max_len = 64];
  EmailAddress from = 14;
  repeated EmailAttachment attachments = 15;

  option (buf.validate.message).cel = {
    id: "vendor_account_pair"
    message: "vendor and account must both be set or both be empty"
    expression: "(this.vendor == 0 && this.account == '') || (this.vendor != 0 && this.account != '')"
  };
  option (buf.validate.message).cel = {
    id: "scene_required"
    message: "scene is required"
    expression: "this.scene != 0"
  };
}

message SendSMSRequest {
  string region_code = 1 [(buf.validate.field).string.pattern = "^[A-Z]{2}$"];
  string phone = 2 [(buf.validate.field).string.min_len = 1];
  string content = 3;
  string template_id = 4;
  map<string, string> template_params = 5;
  SmsVendor vendor = 6;
  string account = 7;
  SmsScene scene = 8;
  // sender_id NOT exposed — BFF fills from cfg.Message.SenderID (decision 1).
  string idempotency_key = 9 [(buf.validate.field).string.max_len = 64];
  string sign_name = 10 [(buf.validate.field).string.max_len = 64];

  option (buf.validate.message).cel = {
    id: "vendor_account_pair"
    message: "vendor and account must both be set or both be empty"
    expression: "(this.vendor == 0 && this.account == '') || (this.vendor != 0 && this.account != '')"
  };
  option (buf.validate.message).cel = {
    id: "scene_required"
    message: "scene is required"
    expression: "this.scene != 0"
  };
  option (buf.validate.message).cel = {
    id: "phone_no_plus"
    message: "phone must not start with '+'"
    expression: "!this.phone.startsWith('+')"
  };
}

// SendResponse 拆下游 oneof 为两个可选字段（决策 6），同一时刻仅一个非 0。
message SendResponse {
  int64 id = 1;
  MessageStatus status = 2;
  EmailVendor email_vendor = 3;
  SmsVendor sms_vendor = 4;
}

// ---- Records（全字段保留，ops 高保真——决策 7）----

message EmailRecord {
  int64 id = 1;
  EmailVendor vendor = 2;
  string account = 3;
  EmailScene scene = 4;
  MessageStatus status = 5;
  EmailAddress target = 6;
  string sender_id = 7;            // 只读回显（testkit 发的即 cfg.Message.SenderID）
  repeated EmailAddress cc = 8;
  repeated EmailAddress bcc = 9;
  string subject = 10;
  string content = 11;
  string html_body = 12;
  EmailAddress reply_to = 13;
  string template_id = 14;
  map<string, string> template_params = 15;
  string error_message = 16;
  int32 attempts = 17;
  int64 sent_at = 18;
  int64 created_at = 19;
  int64 updated_at = 20;
  repeated EmailAttachment attachments = 21;
}

message SMSRecord {
  int64 id = 1;
  SmsVendor vendor = 2;
  string account = 3;
  SmsScene scene = 4;
  MessageStatus status = 5;
  string region_code = 6;
  string phone = 7;
  string sender_id = 8;
  string content = 9;
  string template_id = 10;
  map<string, string> template_params = 11;
  string error_message = 12;
  int32 attempts = 13;
  int64 sent_at = 14;
  int64 created_at = 15;
  int64 updated_at = 16;
}

// ---- Get（资源 ID 保留——决策 3）----

message GetEmailRequest {
  int64 id = 1 [(buf.validate.field).int64.gt = 0];
}
message GetSMSRequest {
  int64 id = 1 [(buf.validate.field).int64.gt = 0];
}

// ---- List paged（sender_id 过滤去掉——决策 2）----

message ListEmailsRequest {
  EmailVendor vendor = 1;
  EmailScene scene = 2;
  MessageStatus status = 3;
  string target = 4;
  int64 start_time = 5;
  int64 end_time = 6;
  int32 page = 7;
  int32 page_size = 8;
  SortField sort_field = 9;
  SortDirection sort_direction = 10;
}
message ListEmailsResponse {
  repeated EmailRecord records = 1;
  int32 total = 2;
  int32 total_pages = 3;
  bool has_more = 4;
}

message ListSMSRequest {
  SmsVendor vendor = 1;
  SmsScene scene = 2;
  MessageStatus status = 3;
  string region_code = 4;
  string phone = 5;
  int64 start_time = 6;
  int64 end_time = 7;
  int32 page = 8;
  int32 page_size = 9;
  SortField sort_field = 10;
  SortDirection sort_direction = 11;
}
message ListSMSResponse {
  repeated SMSRecord records = 1;
  int32 total = 2;
  int32 total_pages = 3;
  bool has_more = 4;
}

// ---- List cursor（sender_id 过滤去掉）----

message ListEmailsByCursorRequest {
  EmailVendor vendor = 1;
  EmailScene scene = 2;
  MessageStatus status = 3;
  string target = 4;
  int64 start_time = 5;
  int64 end_time = 6;
  SortField sort_field = 7;
  SortDirection sort_direction = 8;
  int32 page_size = 9;
  string page_token = 10;
  bool include_total = 11;
}
message ListEmailsByCursorResponse {
  repeated EmailRecord records = 1;
  int32 total = 2;
  string next_page_token = 3;
}

message ListSMSByCursorRequest {
  SmsVendor vendor = 1;
  SmsScene scene = 2;
  MessageStatus status = 3;
  string region_code = 4;
  string phone = 5;
  int64 start_time = 6;
  int64 end_time = 7;
  SortField sort_field = 8;
  SortDirection sort_direction = 9;
  int32 page_size = 10;
  string page_token = 11;
  bool include_total = 12;
}
message ListSMSByCursorResponse {
  repeated SMSRecord records = 1;
  int32 total = 2;
  string next_page_token = 3;
}

// ---- Stats（sender_id 过滤去掉）----

message GetEmailStatsRequest {
  EmailVendor vendor = 1;
  EmailScene scene = 2;
  int64 start_time = 3;
  int64 end_time = 4;
}
message EmailStatsResponse {
  int64 total = 1;
  int64 sent = 2;
  int64 failed = 3;
  double success_rate = 4;         // [0,100]; -1 = no data
  repeated EmailVendorStats vendors = 5;
}

message GetSMSStatsRequest {
  SmsVendor vendor = 1;
  SmsScene scene = 2;
  int64 start_time = 3;
  int64 end_time = 4;
}
message SMSStatsResponse {
  int64 total = 1;
  int64 sent = 2;
  int64 failed = 3;
  double success_rate = 4;
  repeated SmsVendorStats vendors = 5;
}

// ---- Lookups（下拉数据源）----

message ListEmailSendersRequest {}
message ListEmailSendersResponse {
  repeated string sender_ids = 1;
}
message ListSMSSendersRequest {}
message ListSMSSendersResponse {
  repeated string sender_ids = 1;
}
message ListSMSRegionsRequest {}
message ListSMSRegionsResponse {
  repeated string region_codes = 1;
}
```

- [ ] **Step 3: 在 `service TestKitService { ... }` 块内追加 13 个 RPC（带 google.api.http 注解）**

```proto
  // ---- Message (P4) ----

  // Send（sender_id 由 BFF 从 config 注入）
  rpc SendEmail(SendEmailRequest) returns (SendResponse) {
    option (google.api.http) = {
      post: "/api/v1/messages:email"
      body: "*"
    };
  }
  rpc SendSMS(SendSMSRequest) returns (SendResponse) {
    option (google.api.http) = {
      post: "/api/v1/messages:sms"
      body: "*"
    };
  }

  // Email records
  rpc GetEmail(GetEmailRequest) returns (EmailRecord) {
    option (google.api.http) = { get: "/api/v1/emails/{id}" };
  }
  rpc ListEmails(ListEmailsRequest) returns (ListEmailsResponse) {
    option (google.api.http) = { get: "/api/v1/emails" };
  }
  rpc ListEmailsByCursor(ListEmailsByCursorRequest) returns (ListEmailsByCursorResponse) {
    option (google.api.http) = { get: "/api/v1/emails:cursor" };
  }
  rpc GetEmailStats(GetEmailStatsRequest) returns (EmailStatsResponse) {
    option (google.api.http) = { get: "/api/v1/emails:stats" };
  }
  rpc ListEmailSenders(ListEmailSendersRequest) returns (ListEmailSendersResponse) {
    option (google.api.http) = { get: "/api/v1/emails:senders" };
  }

  // SMS records
  rpc GetSMS(GetSMSRequest) returns (SMSRecord) {
    option (google.api.http) = { get: "/api/v1/sms/{id}" };
  }
  rpc ListSMS(ListSMSRequest) returns (ListSMSResponse) {
    option (google.api.http) = { get: "/api/v1/sms" };
  }
  rpc ListSMSByCursor(ListSMSByCursorRequest) returns (ListSMSByCursorResponse) {
    option (google.api.http) = { get: "/api/v1/sms:cursor" };
  }
  rpc GetSMSStats(GetSMSStatsRequest) returns (SMSStatsResponse) {
    option (google.api.http) = { get: "/api/v1/sms:stats" };
  }
  rpc ListSMSRegions(ListSMSRegionsRequest) returns (ListSMSRegionsResponse) {
    option (google.api.http) = { get: "/api/v1/sms:regions" };
  }
  rpc ListSMSSenders(ListSMSSendersRequest) returns (ListSMSSendersResponse) {
    option (google.api.http) = { get: "/api/v1/sms:senders" };
  }
```

- [ ] **Step 4: 重生成 + 验证 proto 编译**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto
go build ./...
```

Expected: `gen/testkit/v1/` 含全部新 message + 13 RPC；`api/swagger/testkit/v1/testkit.swagger.json` 重生（grep 到 `"SendEmail"`、`"/api/v1/emails:cursor"`）。`go build` 会因 `pkg/handler` / `internal/service` 未实现新 RPC 而 FAIL——预期，后续 Task 补。仅确认 proto 生成成功。

- [ ] **Step 5: Commit**

```bash
git add api/proto/ gen/ api/swagger/
git commit -m "feat(proto): add P4 message RPCs with curated self-contained messages"
```

---

## Task 2: pkg/xcodes/message.go + MessageConfig.SenderID

**Files:**
- Create: `pkg/xcodes/message.go`
- Modify: `pkg/config/config.go`
- Modify: `pkg/config/config_test.go`
- Modify: `config.example.yaml`

- [ ] **Step 1: 写 config 测试（断言 Message.SenderID 默认值）**

`pkg/config/config_test.go` 追加（沿用 P1 Task 3 已有的 `TestLoad_Defaults` 风格）：

```go
func TestLoad_MessageSenderIDDefault(t *testing.T) {
    t.Setenv("TESTKIT_CONFIG", "config.example.yaml")
    cfg, err := config.Load()
    require.NoError(t, err)
    require.NotNil(t, cfg.Message)
    require.Equal(t, "testkit-service", cfg.Message.SenderID)
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd /Users/moss/code/servekit/testkit-service
go test ./pkg/config/...
```

Expected: FAIL（`cfg.Message` 为 nil）。

- [ ] **Step 3: 改 config.go（加 MessageConfig）**

`pkg/config/config.go` 的 `Config` struct 加字段 + 新类型：

```go
type Config struct {
    Server     *ServerConfig
    Database   *dbx.Config
    Redis      *redisx.Config
    JWT        *JWTConfig
    CORS       *CORSConfig
    ThirdParty *ThirdPartyConfig
    Message    *MessageConfig   // P4: message-domain sender identity.
    Log        *logging.Config
}

// MessageConfig holds testkit-side message-domain settings (P4).
// SenderID is the value BFF injects into downstream Send requests' sender_id
// field. It is a service label (e.g. "testkit-service"), NOT a user id — see
// plan decision 1.
type MessageConfig struct {
    SenderID string `default:"testkit-service"`
}
```

- [ ] **Step 4: 改 config.example.yaml（加 message 段）**

`config.example.yaml` 追加（与 P1/P3 已有结构平级）：

```yaml
message:
  sender_id: "testkit-service"
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
go test ./pkg/config/...
```

Expected: PASS。

- [ ] **Step 6: 建 pkg/xcodes/message.go（防御性错误码）**

`pkg/xcodes/message.go`：

```go
// Package xcodes holds testkit-service's own error codes, grouped by domain.
// Most message-RPC errors are downstream xerr passthrough (vendor failures,
// persistence disabled, record not found). This file covers testkit-originated
// conditions only.
package xcodes

import "github.com/servekit/go-common/xerr"

// ErrSenderNotConfigured is returned when cfg.Message.SenderID is empty at send
// time. Defense-in-depth: service.New fail-fasts on empty SenderID (Task 10),
// so this should never reach a client at runtime.
var ErrSenderNotConfigured = xerr.New(
    "sender_not_configured",
    xerr.CategoryInternal,
    500,
    "message sender_id is not configured",
)
```

- [ ] **Step 7: 验证编译 + Commit**

```bash
go build ./...
git add pkg/xcodes/message.go pkg/config/ config.example.yaml
git commit -m "feat(config,xcodes): add MessageConfig.SenderID default + message xcodes"
```

---

## Task 3: message 域 SendEmail（Service + 嵌套 converter + sender 注入）

本任务建立 message 域骨架：`Service` struct、`MessageClient` 接口（全部 13 方法一次性定义，real `*message.Handler` 满足）、stub 测试基座（embed `UnimplementedMessageServiceServer`）、`New`、`SendEmail`、嵌套 converter（EmailAddress / EmailAttachment）、`toTestkitSendResponse`（oneof→两字段）。后续 Task 只加 Service 方法 + converter + 测试。

**Files:**
- Create: `internal/service/message/message.go`
- Create: `internal/service/message/message_test.go`

- [ ] **Step 1: 写 message_test.go（stub 基座 + SendEmail 测试）**

`internal/service/message/message_test.go`：

```go
package message_test

import (
    "context"
    "testing"

    "github.com/servekit/message-service/gen/message/v1"
    "github.com/stretchr/testify/require"
    "go.uber.org/mock/gomock" // 仅占位，本域用手工 stub；若 go.mod 未引可删该行

    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    "github.com/servekit/testkit-service/internal/service/message"
)

// stubMessageClient embeds the unimplemented server so it satisfies the full
// MessageClient interface; each test overrides only the method under test and
// inspects the captured request. Grown task-by-task.
type stubMessageClient struct {
    messagev1.UnimplementedMessageServiceServer

    // SendEmail
    sendEmailReq  *messagev1.SendEmailRequest
    sendEmailResp *messagev1.SendResponse
    sendEmailErr  error
    // SendSMS (Task 4)
    sendSMSReq  *messagev1.SendSMSRequest
    sendSMSResp *messagev1.SendResponse
    sendSMSErr  error
    // Get (Task 5)
    getEmailReq  *messagev1.GetEmailRequest
    getEmailResp *messagev1.EmailRecord
    getEmailErr  error
    getSMSReq    *messagev1.GetSMSRequest
    getSMSResp   *messagev1.SMSRecord
    getSMSErr    error
    // List paged (Task 6)
    listEmailsReq  *messagev1.ListEmailsRequest
    listEmailsResp *messagev1.ListEmailsResponse
    listEmailsErr  error
    listSMSReq     *messagev1.ListSMSRequest
    listSMSResp    *messagev1.ListSMSResponse
    listSMSErr     error
    // List cursor (Task 7)
    listEmailsByCursorReq  *messagev1.ListEmailsByCursorRequest
    listEmailsByCursorResp *messagev1.ListEmailsByCursorResponse
    listEmailsByCursorErr  error
    listSMSByCursorReq     *messagev1.ListSMSByCursorRequest
    listSMSByCursorResp    *messagev1.ListSMSByCursorResponse
    listSMSByCursorErr     error
    // Stats (Task 8)
    getEmailStatsReq  *messagev1.GetEmailStatsRequest
    getEmailStatsResp *messagev1.EmailStatsResponse
    getEmailStatsErr  error
    getSMSStatsReq    *messagev1.GetSMSStatsRequest
    getSMSStatsResp   *messagev1.SMSStatsResponse
    getSMSStatsErr    error
    // Lookups (Task 9)
    listEmailSendersReq  *messagev1.ListEmailSendersRequest
    listEmailSendersResp *messagev1.ListEmailSendersResponse
    listEmailSendersErr  error
    listSMSSendersReq    *messagev1.ListSMSSendersRequest
    listSMSSendersResp   *messagev1.ListSMSSendersResponse
    listSMSSendersErr    error
    listSMSRegionsReq    *messagev1.ListSMSRegionsRequest
    listSMSRegionsResp   *messagev1.ListSMSRegionsResponse
    listSMSRegionsErr    error
}

func (s *stubMessageClient) SendEmail(ctx context.Context, req *messagev1.SendEmailRequest) (*messagev1.SendResponse, error) {
    s.sendEmailReq = req
    return s.sendEmailResp, s.sendEmailErr
}

// TestSendEmail_InjectsSenderIDFromConfig verifies the core curation (decision 1):
// testkit request has NO sender_id field; the converter fills the downstream
// sender_id from the configured value.
func TestSendEmail_InjectsSenderIDFromConfig(t *testing.T) {
    stub := &stubMessageClient{
        sendEmailResp: &messagev1.SendResponse{
            Id:     7001,
            Status: messagev1.MessageStatus_MESSAGE_STATUS_SENT,
            Vendor: &messagev1.SendResponse_EmailVendor{EmailVendor: messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN},
        },
    }
    svc := message.New(stub, message.WithSenderID("testkit-service"))

    resp, err := svc.SendEmail(context.Background(), &testkitv1.SendEmailRequest{
        To:      []*testkitv1.EmailAddress{{Email: "alice@example.com", DisplayName: "Alice"}},
        Subject: "hello",
        Body:    "body",
        Scene:   testkitv1.EmailScene_EMAIL_SCENE_NOTIFICATION,
    })
    require.NoError(t, err)
    // sender_id injected from config, NOT from the testkit request
    require.Equal(t, "testkit-service", stub.sendEmailReq.GetSenderId())
    // nested EmailAddress mapped
    require.Equal(t, "alice@example.com", stub.sendEmailReq.GetTo()[0].GetEmail())
    require.Equal(t, "Alice", stub.sendEmailReq.GetTo()[0].GetDisplayName())
    // scene int-cast
    require.Equal(t, messagev1.EmailScene_EMAIL_SCENE_NOTIFICATION, stub.sendEmailReq.GetScene())
    // response oneof → split fields (decision 6)
    require.Equal(t, int64(7001), resp.GetId())
    require.Equal(t, testkitv1.MessageStatus_MESSAGE_STATUS_SENT, resp.GetStatus())
    require.Equal(t, testkitv1.EmailVendor_EMAIL_VENDOR_ALIYUN, resp.GetEmailVendor())
    require.Equal(t, testkitv1.SmsVendor_SMS_VENDOR_UNSPECIFIED, resp.GetSmsVendor())
}

// TestSendEmail_PassesAttachmentsAndIdempotencyKey verifies nested attachments
// + idempotency_key pass-through (attachments url XOR content enforced downstream).
func TestSendEmail_PassesAttachmentsAndIdempotencyKey(t *testing.T) {
    stub := &stubMessageClient{sendEmailResp: &messagev1.SendResponse{Id: 8}}
    svc := message.New(stub, message.WithSenderID("tk"))

    _, err := svc.SendEmail(context.Background(), &testkitv1.SendEmailRequest{
        To:      []*testkitv1.EmailAddress{{Email: "b@x.com"}},
        Subject: "s",
        Body:    "b",
        Scene:   testkitv1.EmailScene_EMAIL_SCENE_NOTIFICATION,
        Attachments: []*testkitv1.EmailAttachment{{
            Filename: "report.pdf",
            Url:      "https://oss.example.com/report.pdf",
            SizeBytes: 1024,
        }},
        IdempotencyKey: "idem-uuid-1",
    })
    require.NoError(t, err)
    require.Len(t, stub.sendEmailReq.GetAttachments(), 1)
    require.Equal(t, "report.pdf", stub.sendEmailReq.GetAttachments()[0].GetFilename())
    require.Equal(t, "https://oss.example.com/report.pdf", stub.sendEmailReq.GetAttachments()[0].GetUrl())
    require.Equal(t, int64(1024), stub.sendEmailReq.GetAttachments()[0].GetSizeBytes())
    require.Equal(t, "idem-uuid-1", stub.sendEmailReq.GetIdempotencyKey())
}
```

> 注：`go.uber.org/mock/gomock` 那行 import 仅占位，本域用手工 stub 不需要它——若 `go.mod` 没引该包就删掉该行（保留会编译错）。实现时只留实际用到的 import。

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/message/...
```

Expected: FAIL（包不存在）。

- [ ] **Step 3: 写 message.go（Service + MessageClient + New + SendEmail + 嵌套 converter）**

`internal/service/message/message.go`：

```go
// Package message implements testkit's message domain: forward to
// message-service with self-contained DTO mapping. This is the ONLY file
// importing both testkitv1 and messagev1 (v2 §3.4).
package message

import (
    "context"

    messagev1 "github.com/servekit/message-service/gen/message/v1"
    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
)

// MessageClient is the subset of the embedded message-service handler the
// message domain uses (all 13 P4 RPCs). Satisfied by *message.Handler (which
// implements messagev1.MessageServiceServer) and by the test stub.
type MessageClient interface {
    SendEmail(ctx context.Context, req *messagev1.SendEmailRequest) (*messagev1.SendResponse, error)
    SendSMS(ctx context.Context, req *messagev1.SendSMSRequest) (*messagev1.SendResponse, error)
    GetEmail(ctx context.Context, req *messagev1.GetEmailRequest) (*messagev1.EmailRecord, error)
    ListEmails(ctx context.Context, req *messagev1.ListEmailsRequest) (*messagev1.ListEmailsResponse, error)
    ListEmailsByCursor(ctx context.Context, req *messagev1.ListEmailsByCursorRequest) (*messagev1.ListEmailsByCursorResponse, error)
    GetEmailStats(ctx context.Context, req *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error)
    ListEmailSenders(ctx context.Context, req *messagev1.ListEmailSendersRequest) (*messagev1.ListEmailSendersResponse, error)
    GetSMS(ctx context.Context, req *messagev1.GetSMSRequest) (*messagev1.SMSRecord, error)
    ListSMS(ctx context.Context, req *messagev1.ListSMSRequest) (*messagev1.ListSMSResponse, error)
    ListSMSByCursor(ctx context.Context, req *messagev1.ListSMSByCursorRequest) (*messagev1.ListSMSByCursorResponse, error)
    GetSMSStats(ctx context.Context, req *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error)
    ListSMSRegions(ctx context.Context, req *messagev1.ListSMSRegionsRequest) (*messagev1.ListSMSRegionsResponse, error)
    ListSMSSenders(ctx context.Context, req *messagev1.ListSMSSendersRequest) (*messagev1.ListSMSSendersResponse, error)
}

// Service implements the message domain.
type Service struct {
    messageClient MessageClient
    senderID      string // injected into downstream Send requests (decision 1)
}

// Option configures Service.
type Option func(*Service)

// WithSenderID sets the sender_id BFF injects into Send requests.
func WithSenderID(id string) Option { return func(s *Service) { s.senderID = id } }

// New constructs the message service. senderID must be non-empty (wiring layer
// fail-fasts on empty cfg.Message.SenderID).
func New(client MessageClient, opts ...Option) *Service {
    s := &Service{messageClient: client}
    for _, o := range opts {
        o(s)
    }
    return s
}

// SendEmail forwards to message-service with sender_id injected from config.
func (s *Service) SendEmail(ctx context.Context, req *testkitv1.SendEmailRequest) (*testkitv1.SendResponse, error) {
    resp, err := s.messageClient.SendEmail(ctx, toMessageSendEmailRequest(req, s.senderID))
    if err != nil {
        return nil, err
    }
    return toTestkitSendResponse(resp), nil
}

// --- converters (testkit DTO ↔ message-service proto) ---

func toMessageSendEmailRequest(r *testkitv1.SendEmailRequest, senderID string) *messagev1.SendEmailRequest {
    return &messagev1.SendEmailRequest{
        To:             toMessageEmailAddresses(r.GetTo()),
        Cc:             toMessageEmailAddresses(r.GetCc()),
        Bcc:            toMessageEmailAddresses(r.GetBcc()),
        Subject:        r.GetSubject(),
        Body:           r.GetBody(),
        HtmlBody:       r.GetHtmlBody(),
        ReplyTo:        toMessageEmailAddress(r.GetReplyTo()),
        Vendor:         messagev1.EmailVendor(r.GetVendor()),
        Account:        r.GetAccount(),
        TemplateId:     r.GetTemplateId(),
        TemplateParams: r.GetTemplateParams(),
        Scene:          messagev1.EmailScene(r.GetScene()),
        SenderId:       senderID, // decision 1: from config, not from testkit request
        IdempotencyKey: r.GetIdempotencyKey(),
        From:           toMessageEmailAddress(r.GetFrom()),
        Attachments:    toMessageEmailAttachments(r.GetAttachments()),
    }
}

func toMessageEmailAddress(a *testkitv1.EmailAddress) *messagev1.EmailAddress {
    if a == nil {
        return nil
    }
    return &messagev1.EmailAddress{Email: a.GetEmail(), DisplayName: a.GetDisplayName()}
}

func toMessageEmailAddresses(as []*testkitv1.EmailAddress) []*messagev1.EmailAddress {
    out := make([]*messagev1.EmailAddress, 0, len(as))
    for _, a := range as {
        out = append(out, toMessageEmailAddress(a))
    }
    return out
}

func toMessageEmailAttachment(a *testkitv1.EmailAttachment) *messagev1.EmailAttachment {
    if a == nil {
        return nil
    }
    return &messagev1.EmailAttachment{
        Filename:  a.GetFilename(),
        Url:       a.GetUrl(),
        Content:   a.GetContent(),
        Inline:    a.GetInline(),
        MimeType:  a.GetMimeType(),
        SizeBytes: a.GetSizeBytes(),
    }
}

func toMessageEmailAttachments(as []*testkitv1.EmailAttachment) []*messagev1.EmailAttachment {
    out := make([]*messagev1.EmailAttachment, 0, len(as))
    for _, a := range as {
        out = append(out, toMessageEmailAttachment(a))
    }
    return out
}

// toTestkitSendResponse splits the downstream oneof vendor into two optional
// fields (decision 6).
func toTestkitSendResponse(r *messagev1.SendResponse) *testkitv1.SendResponse {
    if r == nil {
        return nil
    }
    resp := &testkitv1.SendResponse{
        Id:     r.GetId(),
        Status: testkitv1.MessageStatus(r.GetStatus()),
    }
    switch v := r.GetVendor().(type) {
    case *messagev1.SendResponse_EmailVendor:
        resp.EmailVendor = testkitv1.EmailVendor(v.EmailVendor)
    case *messagev1.SendResponse_SmsVendor:
        resp.SmsVendor = testkitv1.SmsVendor(v.SmsVendor)
    }
    return resp
}
```

> 注：枚举整型直转 `messagev1.EmailScene(r.GetScene())`——testkit enum 镜像 message-service 同名同号（Task 1 enum 块），int32 值一致。

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/message/...
```

Expected: PASS（两个 SendEmail 测试绿）。

- [ ] **Step 5: Commit**

```bash
git add internal/service/message/
git commit -m "feat(message): SendEmail domain with nested converters + sender-from-config"
```

---

## Task 4: message 域 SendSMS

**Files:**
- Modify: `internal/service/message/message.go`
- Modify: `internal/service/message/message_test.go`

- [ ] **Step 1: 测试补 SendSMS（stub 加方法 + 测试函数）**

在 `message_test.go` 的 `stubMessageClient` 加 SendSMS override（已有 `sendSMSReq/Resp/Err` 字段）：

```go
func (s *stubMessageClient) SendSMS(ctx context.Context, req *messagev1.SendSMSRequest) (*messagev1.SendResponse, error) {
    s.sendSMSReq = req
    return s.sendSMSResp, s.sendSMSErr
}
```

追加测试函数：

```go
// TestSendSMS_InjectsSenderIDFromConfig verifies SMS send also injects
// sender_id from config (decision 1) and maps scene/vendor via int cast.
func TestSendSMS_InjectsSenderIDFromConfig(t *testing.T) {
    stub := &stubMessageClient{
        sendSMSResp: &messagev1.SendResponse{
            Id:     9001,
            Status: messagev1.MessageStatus_MESSAGE_STATUS_SENT,
            Vendor: &messagev1.SendResponse_SmsVendor{SmsVendor: messagev1.SmsVendor_SMS_VENDOR_ALIYUN},
        },
    }
    svc := message.New(stub, message.WithSenderID("testkit-service"))

    resp, err := svc.SendSMS(context.Background(), &testkitv1.SendSMSRequest{
        RegionCode: "CN",
        Phone:      "13800138000",
        SignName:   "testkit",
        TemplateId: "SMS_123",
        TemplateParams: map[string]string{"code": "888888"},
        Scene:      testkitv1.SmsScene_SMS_SCENE_LOGIN_CODE,
    })
    require.NoError(t, err)
    require.Equal(t, "testkit-service", stub.sendSMSReq.GetSenderId())
    require.Equal(t, "CN", stub.sendSMSReq.GetRegionCode())
    require.Equal(t, "13800138000", stub.sendSMSReq.GetPhone())
    require.Equal(t, messagev1.SmsScene_SMS_SCENE_LOGIN_CODE, stub.sendSMSReq.GetScene())
    require.Equal(t, map[string]string{"code": "888888"}, stub.sendSMSReq.GetTemplateParams())
    // response: SMS branch of the oneof
    require.Equal(t, int64(9001), resp.GetId())
    require.Equal(t, testkitv1.SmsVendor_SMS_VENDOR_ALIYUN, resp.GetSmsVendor())
    require.Equal(t, testkitv1.EmailVendor_EMAIL_VENDOR_UNSPECIFIED, resp.GetEmailVendor())
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/message/...
```

Expected: FAIL（`svc.SendSMS` 未定义）。

- [ ] **Step 3: 实现 SendSMS + converter**

在 `message.go` 的 `Service` 上加方法，并在 `// --- converters ---` 下加 `toMessageSendSMSRequest`：

```go
// SendSMS forwards to message-service with sender_id injected from config.
func (s *Service) SendSMS(ctx context.Context, req *testkitv1.SendSMSRequest) (*testkitv1.SendResponse, error) {
    resp, err := s.messageClient.SendSMS(ctx, toMessageSendSMSRequest(req, s.senderID))
    if err != nil {
        return nil, err
    }
    return toTestkitSendResponse(resp), nil
}
```

```go
func toMessageSendSMSRequest(r *testkitv1.SendSMSRequest, senderID string) *messagev1.SendSMSRequest {
    return &messagev1.SendSMSRequest{
        RegionCode:     r.GetRegionCode(),
        Phone:          r.GetPhone(),
        Content:        r.GetContent(),
        TemplateId:     r.GetTemplateId(),
        TemplateParams: r.GetTemplateParams(),
        Vendor:         messagev1.SmsVendor(r.GetVendor()),
        Account:        r.GetAccount(),
        Scene:          messagev1.SmsScene(r.GetScene()),
        SenderId:       senderID, // decision 1
        IdempotencyKey: r.GetIdempotencyKey(),
        SignName:       r.GetSignName(),
    }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/message/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/service/message/
git commit -m "feat(message): SendSMS domain with sender-from-config injection"
```

---

## Task 5: message 域 GetEmail + GetSMS（record converter）

建立 record 全字段 converter（`toTestkitEmailRecord`/`toTestkitSMSRecord` + 反向 EmailAddress/Attachment converter），供 Get + List + Cursor 复用。

**Files:**
- Modify: `internal/service/message/message.go`
- Modify: `internal/service/message/message_test.go`

- [ ] **Step 1: 测试补 Get + record converter 覆盖**

stub 加 Get override：

```go
func (s *stubMessageClient) GetEmail(ctx context.Context, req *messagev1.GetEmailRequest) (*messagev1.EmailRecord, error) {
    s.getEmailReq = req
    return s.getEmailResp, s.getEmailErr
}
func (s *stubMessageClient) GetSMS(ctx context.Context, req *messagev1.GetSMSRequest) (*messagev1.SMSRecord, error) {
    s.getSMSReq = req
    return s.getSMSResp, s.getSMSErr
}
```

测试函数：

```go
// TestGetEmail_MapsAllFields verifies the EmailRecord converter preserves every
// field (ops console needs full fidelity — decision 7), incl. nested addresses.
func TestGetEmail_MapsAllFields(t *testing.T) {
    stub := &stubMessageClient{getEmailResp: &messagev1.EmailRecord{
        Id: 1, Vendor: messagev1.EmailVendor_EMAIL_VENDOR_TENCENT, Account: "acc",
        Scene: messagev1.EmailScene_EMAIL_SCENE_REGISTER,
        Status: messagev1.MessageStatus_MESSAGE_STATUS_FAILED,
        Target: &messagev1.EmailAddress{Email: "to@x.com", DisplayName: "To"},
        SenderId: "testkit-service",
        Cc: []*messagev1.EmailAddress{{Email: "cc@x.com"}},
        Subject: "subj", Content: "txt", HtmlBody: "<b>html</b>",
        TemplateId: "T1", TemplateParams: map[string]string{"k": "v"},
        ErrorMessage: "boom", Attempts: 3, SentAt: 100, CreatedAt: 90, UpdatedAt: 110,
        Attachments: []*messagev1.EmailAttachment{{Filename: "a.pdf", Url: "https://o/a.pdf", SizeBytes: 5}},
    }}
    svc := message.New(stub, message.WithSenderID("testkit-service"))

    got, err := svc.GetEmail(context.Background(), &testkitv1.GetEmailRequest{Id: 1})
    require.NoError(t, err)
    require.Equal(t, int64(1), got.GetId())
    require.Equal(t, testkitv1.EmailVendor_EMAIL_VENDOR_TENCENT, got.GetVendor())
    require.Equal(t, testkitv1.EmailScene_EMAIL_SCENE_REGISTER, got.GetScene())
    require.Equal(t, testkitv1.MessageStatus_MESSAGE_STATUS_FAILED, got.GetStatus())
    require.Equal(t, "to@x.com", got.GetTarget().GetEmail())
    require.Len(t, got.GetCc(), 1)
    require.Equal(t, "subj", got.GetSubject())
    require.Equal(t, map[string]string{"k": "v"}, got.GetTemplateParams())
    require.Equal(t, "boom", got.GetErrorMessage())
    require.Equal(t, int32(3), got.GetAttempts())
    require.Len(t, got.GetAttachments(), 1)
    require.Equal(t, "a.pdf", got.GetAttachments()[0].GetFilename())
    // request id passthrough
    require.Equal(t, int64(1), stub.getEmailReq.GetId())
}

func TestGetSMS_MapsAllFields(t *testing.T) {
    stub := &stubMessageClient{getSMSResp: &messagev1.SMSRecord{
        Id: 2, Vendor: messagev1.SmsVendor_SMS_VENDOR_VOLCENGINE,
        Scene: messagev1.SmsScene_SMS_SCENE_REGISTER,
        Status: messagev1.MessageStatus_MESSAGE_STATUS_SENT,
        RegionCode: "US", Phone: "5551234567", SenderId: "testkit-service",
        Content: "hi", ErrorMessage: "", Attempts: 1, SentAt: 200, CreatedAt: 190,
    }}
    svc := message.New(stub, message.WithSenderID("testkit-service"))

    got, err := svc.GetSMS(context.Background(), &testkitv1.GetSMSRequest{Id: 2})
    require.NoError(t, err)
    require.Equal(t, int64(2), got.GetId())
    require.Equal(t, testkitv1.SmsVendor_SMS_VENDOR_VOLCENGINE, got.GetVendor())
    require.Equal(t, "US", got.GetRegionCode())
    require.Equal(t, "5551234567", got.GetPhone())
    require.Equal(t, int32(1), got.GetAttempts())
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/message/...
```

Expected: FAIL（`svc.GetEmail` / `GetSMS` 未定义）。

- [ ] **Step 3: 实现 Get 方法 + record converter + 反向嵌套 converter**

在 `message.go` 的 `Service` 上加方法：

```go
// GetEmail returns one email record by id.
func (s *Service) GetEmail(ctx context.Context, req *testkitv1.GetEmailRequest) (*testkitv1.EmailRecord, error) {
    resp, err := s.messageClient.GetEmail(ctx, toMessageGetEmailRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitEmailRecord(resp), nil
}

// GetSMS returns one SMS record by id.
func (s *Service) GetSMS(ctx context.Context, req *testkitv1.GetSMSRequest) (*testkitv1.SMSRecord, error) {
    resp, err := s.messageClient.GetSMS(ctx, toMessageGetSMSRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitSMSRecord(resp), nil
}
```

在 `// --- converters ---` 下加：

```go
func toMessageGetEmailRequest(r *testkitv1.GetEmailRequest) *messagev1.GetEmailRequest {
    return &messagev1.GetEmailRequest{Id: r.GetId()}
}

func toMessageGetSMSRequest(r *testkitv1.GetSMSRequest) *messagev1.GetSMSRequest {
    return &messagev1.GetSMSRequest{Id: r.GetId()}
}

func toTestkitEmailRecord(r *messagev1.EmailRecord) *testkitv1.EmailRecord {
    if r == nil {
        return nil
    }
    return &testkitv1.EmailRecord{
        Id:             r.GetId(),
        Vendor:         testkitv1.EmailVendor(r.GetVendor()),
        Account:        r.GetAccount(),
        Scene:          testkitv1.EmailScene(r.GetScene()),
        Status:         testkitv1.MessageStatus(r.GetStatus()),
        Target:         toTestkitEmailAddress(r.GetTarget()),
        SenderId:       r.GetSenderId(),
        Cc:             toTestkitEmailAddresses(r.GetCc()),
        Bcc:            toTestkitEmailAddresses(r.GetBcc()),
        Subject:        r.GetSubject(),
        Content:        r.GetContent(),
        HtmlBody:       r.GetHtmlBody(),
        ReplyTo:        toTestkitEmailAddress(r.GetReplyTo()),
        TemplateId:     r.GetTemplateId(),
        TemplateParams: r.GetTemplateParams(),
        ErrorMessage:   r.GetErrorMessage(),
        Attempts:       r.GetAttempts(),
        SentAt:         r.GetSentAt(),
        CreatedAt:      r.GetCreatedAt(),
        UpdatedAt:      r.GetUpdatedAt(),
        Attachments:    toTestkitEmailAttachments(r.GetAttachments()),
    }
}

func toTestkitSMSRecord(r *messagev1.SMSRecord) *testkitv1.SMSRecord {
    if r == nil {
        return nil
    }
    return &testkitv1.SMSRecord{
        Id:             r.GetId(),
        Vendor:         testkitv1.SmsVendor(r.GetVendor()),
        Account:        r.GetAccount(),
        Scene:          testkitv1.SmsScene(r.GetScene()),
        Status:         testkitv1.MessageStatus(r.GetStatus()),
        RegionCode:     r.GetRegionCode(),
        Phone:          r.GetPhone(),
        SenderId:       r.GetSenderId(),
        Content:        r.GetContent(),
        TemplateId:     r.GetTemplateId(),
        TemplateParams: r.GetTemplateParams(),
        ErrorMessage:   r.GetErrorMessage(),
        Attempts:       r.GetAttempts(),
        SentAt:         r.GetSentAt(),
        CreatedAt:      r.GetCreatedAt(),
        UpdatedAt:      r.GetUpdatedAt(),
    }
}

func toTestkitEmailAddress(a *messagev1.EmailAddress) *testkitv1.EmailAddress {
    if a == nil {
        return nil
    }
    return &testkitv1.EmailAddress{Email: a.GetEmail(), DisplayName: a.GetDisplayName()}
}

func toTestkitEmailAddresses(as []*messagev1.EmailAddress) []*testkitv1.EmailAddress {
    out := make([]*testkitv1.EmailAddress, 0, len(as))
    for _, a := range as {
        out = append(out, toTestkitEmailAddress(a))
    }
    return out
}

func toTestkitEmailAttachment(a *messagev1.EmailAttachment) *testkitv1.EmailAttachment {
    if a == nil {
        return nil
    }
    return &testkitv1.EmailAttachment{
        Filename:  a.GetFilename(),
        Url:       a.GetUrl(),
        Content:   a.GetContent(),
        Inline:    a.GetInline(),
        MimeType:  a.GetMimeType(),
        SizeBytes: a.GetSizeBytes(),
    }
}

func toTestkitEmailAttachments(as []*messagev1.EmailAttachment) []*testkitv1.EmailAttachment {
    out := make([]*testkitv1.EmailAttachment, 0, len(as))
    for _, a := range as {
        out = append(out, toTestkitEmailAttachment(a))
    }
    return out
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/message/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/service/message/
git commit -m "feat(message): GetEmail/GetSMS with full-fidelity record converters"
```

---

## Task 6: message 域 ListEmails + ListSMS（offset 分页）

**Files:**
- Modify: `internal/service/message/message.go`
- Modify: `internal/service/message/message_test.go`

- [ ] **Step 1: 测试补 List paged（stub override + 测试，重点验证 sender_id 不下发）**

stub override：

```go
func (s *stubMessageClient) ListEmails(ctx context.Context, req *messagev1.ListEmailsRequest) (*messagev1.ListEmailsResponse, error) {
    s.listEmailsReq = req
    return s.listEmailsResp, s.listEmailsErr
}
func (s *stubMessageClient) ListSMS(ctx context.Context, req *messagev1.ListSMSRequest) (*messagev1.ListSMSResponse, error) {
    s.listSMSReq = req
    return s.listSMSResp, s.listSMSErr
}
```

测试函数：

```go
// TestListEmails_OmitsSenderIDFilter verifies decision 2: the testkit ListEmails
// request has no sender_id field, and the converter does NOT inject one
// downstream (ops console sees all records; sender_id stays zero).
func TestListEmails_OmitsSenderIDFilter(t *testing.T) {
    stub := &stubMessageClient{listEmailsResp: &messagev1.ListEmailsResponse{
        Records:    []*messagev1.EmailRecord{{Id: 1, Subject: "a"}, {Id: 2, Subject: "b"}},
        Total:      2, TotalPages: 1, HasMore: false,
    }}
    svc := message.New(stub, message.WithSenderID("testkit-service"))

    got, err := svc.ListEmails(context.Background(), &testkitv1.ListEmailsRequest{
        Vendor:    testkitv1.EmailVendor_EMAIL_VENDOR_ALIYUN,
        Scene:     testkitv1.EmailScene_EMAIL_SCENE_NOTIFICATION,
        Status:    testkitv1.MessageStatus_MESSAGE_STATUS_SENT,
        Target:    "alice@x.com",
        Page:      1, PageSize: 20,
        SortField:     testkitv1.SortField_SORT_FIELD_CREATED_AT,
        SortDirection: testkitv1.SortDirection_SORT_DIRECTION_DESC,
    })
    require.NoError(t, err)
    // decision 2: no sender_id filter forwarded
    require.Equal(t, "", stub.listEmailsReq.GetSenderId())
    require.Equal(t, messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN, stub.listEmailsReq.GetVendor())
    require.Equal(t, "alice@x.com", stub.listEmailsReq.GetTarget())
    require.Equal(t, int32(1), stub.listEmailsReq.GetPage())
    require.Equal(t, messagev1.SortDirection_SORT_DIRECTION_DESC, stub.listEmailsReq.GetSortDirection())
    // response mapped
    require.Len(t, got.GetRecords(), 2)
    require.Equal(t, int64(1), got.GetRecords()[0].GetId())
    require.Equal(t, int32(2), got.GetTotal())
    require.True(t, got.GetHasMore() == false)
}

func TestListSMS_OmitsSenderIDFilter(t *testing.T) {
    stub := &stubMessageClient{listSMSResp: &messagev1.ListSMSResponse{
        Records: []*messagev1.SMSRecord{{Id: 9, RegionCode: "CN"}},
        Total:   1,
    }}
    svc := message.New(stub, message.WithSenderID("tk"))

    got, err := svc.ListSMS(context.Background(), &testkitv1.ListSMSRequest{
        RegionCode: "CN", Phone: "13800138000", Page: 2, PageSize: 10,
    })
    require.NoError(t, err)
    require.Equal(t, "", stub.listSMSReq.GetSenderId())
    require.Equal(t, "CN", stub.listSMSReq.GetRegionCode())
    require.Equal(t, int32(2), stub.listSMSReq.GetPage())
    require.Len(t, got.GetRecords(), 1)
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/message/...
```

Expected: FAIL。

- [ ] **Step 3: 实现 List 方法 + converter**

在 `Service` 上加方法：

```go
// ListEmails returns an offset-paginated page of email records.
func (s *Service) ListEmails(ctx context.Context, req *testkitv1.ListEmailsRequest) (*testkitv1.ListEmailsResponse, error) {
    resp, err := s.messageClient.ListEmails(ctx, toMessageListEmailsRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitListEmailsResponse(resp), nil
}

// ListSMS returns an offset-paginated page of SMS records.
func (s *Service) ListSMS(ctx context.Context, req *testkitv1.ListSMSRequest) (*testkitv1.ListSMSResponse, error) {
    resp, err := s.messageClient.ListSMS(ctx, toMessageListSMSRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitListSMSResponse(resp), nil
}
```

converter（注意：`SenderId` 字段故意不设——决策 2）：

```go
func toMessageListEmailsRequest(r *testkitv1.ListEmailsRequest) *messagev1.ListEmailsRequest {
    return &messagev1.ListEmailsRequest{
        Vendor:        messagev1.EmailVendor(r.GetVendor()),
        Scene:         messagev1.EmailScene(r.GetScene()),
        Status:        messagev1.MessageStatus(r.GetStatus()),
        Target:        r.GetTarget(),
        StartTime:     r.GetStartTime(),
        EndTime:       r.GetEndTime(),
        Page:          r.GetPage(),
        PageSize:      r.GetPageSize(),
        SortField:     messagev1.SortField(r.GetSortField()),
        SortDirection: messagev1.SortDirection(r.GetSortDirection()),
        // SenderId intentionally omitted — decision 2.
    }
}

func toMessageListSMSRequest(r *testkitv1.ListSMSRequest) *messagev1.ListSMSRequest {
    return &messagev1.ListSMSRequest{
        Vendor:        messagev1.SmsVendor(r.GetVendor()),
        Scene:         messagev1.SmsScene(r.GetScene()),
        Status:        messagev1.MessageStatus(r.GetStatus()),
        RegionCode:    r.GetRegionCode(),
        Phone:         r.GetPhone(),
        StartTime:     r.GetStartTime(),
        EndTime:       r.GetEndTime(),
        Page:          r.GetPage(),
        PageSize:      r.GetPageSize(),
        SortField:     messagev1.SortField(r.GetSortField()),
        SortDirection: messagev1.SortDirection(r.GetSortDirection()),
    }
}

func toTestkitListEmailsResponse(r *messagev1.ListEmailsResponse) *testkitv1.ListEmailsResponse {
    if r == nil {
        return nil
    }
    records := make([]*testkitv1.EmailRecord, 0, len(r.GetRecords()))
    for _, rec := range r.GetRecords() {
        records = append(records, toTestkitEmailRecord(rec))
    }
    return &testkitv1.ListEmailsResponse{
        Records:    records,
        Total:      r.GetTotal(),
        TotalPages: r.GetTotalPages(),
        HasMore:    r.GetHasMore(),
    }
}

func toTestkitListSMSResponse(r *messagev1.ListSMSResponse) *testkitv1.ListSMSResponse {
    if r == nil {
        return nil
    }
    records := make([]*testkitv1.SMSRecord, 0, len(r.GetRecords()))
    for _, rec := range r.GetRecords() {
        records = append(records, toTestkitSMSRecord(rec))
    }
    return &testkitv1.ListSMSResponse{
        Records:    records,
        Total:      r.GetTotal(),
        TotalPages: r.GetTotalPages(),
        HasMore:    r.GetHasMore(),
    }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/message/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/service/message/
git commit -m "feat(message): ListEmails/ListSMS paged (no sender_id filter forwarded)"
```

---

## Task 7: message 域 ListEmailsByCursor + ListSMSByCursor（游标分页）

**Files:**
- Modify: `internal/service/message/message.go`
- Modify: `/internal/service/message/message_test.go`

- [ ] **Step 1: 测试补 cursor（stub override + 测试）**

stub override：

```go
func (s *stubMessageClient) ListEmailsByCursor(ctx context.Context, req *messagev1.ListEmailsByCursorRequest) (*messagev1.ListEmailsByCursorResponse, error) {
    s.listEmailsByCursorReq = req
    return s.listEmailsByCursorResp, s.listEmailsByCursorErr
}
func (s *stubMessageClient) ListSMSByCursor(ctx context.Context, req *messagev1.ListSMSByCursorRequest) (*messagev1.ListSMSByCursorResponse, error) {
    s.listSMSByCursorReq = req
    return s.listSMSByCursorResp, s.listSMSByCursorErr
}
```

测试函数：

```go
// TestListEmailsByCursor_PassesPageTokenAndIncludeTotal verifies cursor pagination
// passthrough: page_token + include_total + next_page_token echo, sender_id omitted.
func TestListEmailsByCursor_PassesPageTokenAndIncludeTotal(t *testing.T) {
    stub := &stubMessageClient{listEmailsByCursorResp: &messagev1.ListEmailsByCursorResponse{
        Records:       []*messagev1.EmailRecord{{Id: 5}},
        Total:         42,
        NextPageToken: "cursor-abc",
    }}
    svc := message.New(stub, message.WithSenderID("tk"))

    got, err := svc.ListEmailsByCursor(context.Background(), &testkitv1.ListEmailsByCursorRequest{
        PageSize:     50,
        PageToken:    "cursor-prev",
        IncludeTotal: true,
        SortField:    testkitv1.SortField_SORT_FIELD_CREATED_AT,
    })
    require.NoError(t, err)
    require.Equal(t, "cursor-prev", stub.listEmailsByCursorReq.GetPageToken())
    require.True(t, stub.listEmailsByCursorReq.GetIncludeTotal())
    require.Equal(t, int32(50), stub.listEmailsByCursorReq.GetPageSize())
    require.Equal(t, "", stub.listEmailsByCursorReq.GetSenderId())
    require.Equal(t, int32(42), got.GetTotal())
    require.Equal(t, "cursor-abc", got.GetNextPageToken())
    require.Len(t, got.GetRecords(), 1)
}

func TestListSMSByCursor_FirstPageEmptyToken(t *testing.T) {
    stub := &stubMessageClient{listSMSByCursorResp: &messagev1.ListSMSByCursorResponse{
        NextPageToken: "",
    }}
    svc := message.New(stub, message.WithSenderID("tk"))

    got, err := svc.ListSMSByCursor(context.Background(), &testkitv1.ListSMSByCursorRequest{PageSize: 10})
    require.NoError(t, err)
    require.Equal(t, "", stub.listSMSByCursorReq.GetPageToken()) // first page
    require.Equal(t, "", got.GetNextPageToken())                 // no next page
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/message/...
```

Expected: FAIL。

- [ ] **Step 3: 实现 cursor 方法 + converter**

`Service` 方法：

```go
// ListEmailsByCursor returns a cursor-paginated page of email records.
func (s *Service) ListEmailsByCursor(ctx context.Context, req *testkitv1.ListEmailsByCursorRequest) (*testkitv1.ListEmailsByCursorResponse, error) {
    resp, err := s.messageClient.ListEmailsByCursor(ctx, toMessageListEmailsByCursorRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitListEmailsByCursorResponse(resp), nil
}

// ListSMSByCursor returns a cursor-paginated page of SMS records.
func (s *Service) ListSMSByCursor(ctx context.Context, req *testkitv1.ListSMSByCursorRequest) (*testkitv1.ListSMSByCursorResponse, error) {
    resp, err := s.messageClient.ListSMSByCursor(ctx, toMessageListSMSByCursorRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitListSMSByCursorResponse(resp), nil
}
```

converter：

```go
func toMessageListEmailsByCursorRequest(r *testkitv1.ListEmailsByCursorRequest) *messagev1.ListEmailsByCursorRequest {
    return &messagev1.ListEmailsByCursorRequest{
        Vendor:        messagev1.EmailVendor(r.GetVendor()),
        Scene:         messagev1.EmailScene(r.GetScene()),
        Status:        messagev1.MessageStatus(r.GetStatus()),
        Target:        r.GetTarget(),
        StartTime:     r.GetStartTime(),
        EndTime:       r.GetEndTime(),
        SortField:     messagev1.SortField(r.GetSortField()),
        SortDirection: messagev1.SortDirection(r.GetSortDirection()),
        PageSize:      r.GetPageSize(),
        PageToken:     r.GetPageToken(),
        IncludeTotal:  r.GetIncludeTotal(),
        // SenderId intentionally omitted — decision 2.
    }
}

func toMessageListSMSByCursorRequest(r *testkitv1.ListSMSByCursorRequest) *messagev1.ListSMSByCursorRequest {
    return &messagev1.ListSMSByCursorRequest{
        Vendor:        messagev1.SmsVendor(r.GetVendor()),
        Scene:         messagev1.SmsScene(r.GetScene()),
        Status:        messagev1.MessageStatus(r.GetStatus()),
        RegionCode:    r.GetRegionCode(),
        Phone:         r.GetPhone(),
        StartTime:     r.GetStartTime(),
        EndTime:       r.GetEndTime(),
        SortField:     messagev1.SortField(r.GetSortField()),
        SortDirection: messagev1.SortDirection(r.GetSortDirection()),
        PageSize:      r.GetPageSize(),
        PageToken:     r.GetPageToken(),
        IncludeTotal:  r.GetIncludeTotal(),
    }
}

func toTestkitListEmailsByCursorResponse(r *messagev1.ListEmailsByCursorResponse) *testkitv1.ListEmailsByCursorResponse {
    if r == nil {
        return nil
    }
    records := make([]*testkitv1.EmailRecord, 0, len(r.GetRecords()))
    for _, rec := range r.GetRecords() {
        records = append(records, toTestkitEmailRecord(rec))
    }
    return &testkitv1.ListEmailsByCursorResponse{
        Records:      records,
        Total:        r.GetTotal(),
        NextPageToken: r.GetNextPageToken(),
    }
}

func toTestkitListSMSByCursorResponse(r *messagev1.ListSMSByCursorResponse) *testkitv1.ListSMSByCursorResponse {
    if r == nil {
        return nil
    }
    records := make([]*testkitv1.SMSRecord, 0, len(r.GetRecords()))
    for _, rec := range r.GetRecords() {
        records = append(records, toTestkitSMSRecord(rec))
    }
    return &testkitv1.ListSMSByCursorResponse{
        Records:       records,
        Total:         r.GetTotal(),
        NextPageToken: r.GetNextPageToken(),
    }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/message/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/service/message/
git commit -m "feat(message): ListEmailsByCursor/ListSMSByCursor cursor pagination"
```

---

## Task 8: message 域 GetEmailStats + GetSMSStats

**Files:**
- Modify: `internal/service/message/message.go`
- Modify: `internal/service/message/message_test.go`

- [ ] **Step 1: 测试补 Stats（stub override + 测试）**

stub override：

```go
func (s *stubMessageClient) GetEmailStats(ctx context.Context, req *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error) {
    s.getEmailStatsReq = req
    return s.getEmailStatsResp, s.getEmailStatsErr
}
func (s *stubMessageClient) GetSMSStats(ctx context.Context, req *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error) {
    s.getSMSStatsReq = req
    return s.getSMSStatsResp, s.getSMSStatsErr
}
```

测试函数：

```go
// TestGetEmailStats_MapsVendorBreakdown verifies the stats response maps
// totals + per-vendor breakdown, and the request filter passes through.
func TestGetEmailStats_MapsVendorBreakdown(t *testing.T) {
    stub := &stubMessageClient{getEmailStatsResp: &messagev1.EmailStatsResponse{
        Total: 10, Sent: 8, Failed: 2, SuccessRate: 80.0,
        Vendors: []*messagev1.EmailVendorStats{
            {Vendor: messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN, Total: 6, Sent: 5, Failed: 1},
            {Vendor: messagev1.EmailVendor_EMAIL_VENDOR_TENCENT, Total: 4, Sent: 3, Failed: 1},
        },
    }}
    svc := message.New(stub, message.WithSenderID("tk"))

    got, err := svc.GetEmailStats(context.Background(), &testkitv1.GetEmailStatsRequest{
        Vendor: testkitv1.EmailVendor_EMAIL_VENDOR_ALIYUN,
        Scene:  testkitv1.EmailScene_EMAIL_SCENE_NOTIFICATION,
        StartTime: 1, EndTime: 2,
    })
    require.NoError(t, err)
    require.Equal(t, messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN, stub.getEmailStatsReq.GetVendor())
    require.Equal(t, int64(10), got.GetTotal())
    require.InDelta(t, 80.0, got.GetSuccessRate(), 0.001)
    require.Len(t, got.GetVendors(), 2)
    require.Equal(t, testkitv1.EmailVendor_EMAIL_VENDOR_ALIYUN, got.GetVendors()[0].GetVendor())
    require.Equal(t, int64(6), got.GetVendors()[0].GetTotal())
}

func TestGetSMSStats_NoData(t *testing.T) {
    stub := &stubMessageClient{getSMSStatsResp: &messagev1.SMSStatsResponse{
        Total: 0, Sent: 0, Failed: 0, SuccessRate: -1,
    }}
    svc := message.New(stub, message.WithSenderID("tk"))

    got, err := svc.GetSMSStats(context.Background(), &testkitv1.GetSMSStatsRequest{})
    require.NoError(t, err)
    require.Equal(t, int64(0), got.GetTotal())
    require.InDelta(t, -1.0, got.GetSuccessRate(), 0.001)
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/message/...
```

Expected: FAIL。

- [ ] **Step 3: 实现 Stats 方法 + converter**

`Service` 方法：

```go
// GetEmailStats returns aggregated email statistics with per-vendor breakdown.
func (s *Service) GetEmailStats(ctx context.Context, req *testkitv1.GetEmailStatsRequest) (*testkitv1.EmailStatsResponse, error) {
    resp, err := s.messageClient.GetEmailStats(ctx, toMessageGetEmailStatsRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitEmailStatsResponse(resp), nil
}

// GetSMSStats returns aggregated SMS statistics with per-vendor breakdown.
func (s *Service) GetSMSStats(ctx context.Context, req *testkitv1.GetSMSStatsRequest) (*testkitv1.SMSStatsResponse, error) {
    resp, err := s.messageClient.GetSMSStats(ctx, toMessageGetSMSStatsRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitSMSStatsResponse(resp), nil
}
```

converter：

```go
func toMessageGetEmailStatsRequest(r *testkitv1.GetEmailStatsRequest) *messagev1.GetEmailStatsRequest {
    return &messagev1.GetEmailStatsRequest{
        Vendor:    messagev1.EmailVendor(r.GetVendor()),
        Scene:     messagev1.EmailScene(r.GetScene()),
        StartTime: r.GetStartTime(),
        EndTime:   r.GetEndTime(),
    }
}

func toMessageGetSMSStatsRequest(r *testkitv1.GetSMSStatsRequest) *messagev1.GetSMSStatsRequest {
    return &messagev1.GetSMSStatsRequest{
        Vendor:    messagev1.SmsVendor(r.GetVendor()),
        Scene:     messagev1.SmsScene(r.GetScene()),
        StartTime: r.GetStartTime(),
        EndTime:   r.GetEndTime(),
    }
}

func toTestkitEmailStatsResponse(r *messagev1.EmailStatsResponse) *testkitv1.EmailStatsResponse {
    if r == nil {
        return nil
    }
    vendors := make([]*testkitv1.EmailVendorStats, 0, len(r.GetVendors()))
    for _, v := range r.GetVendors() {
        vendors = append(vendors, &testkitv1.EmailVendorStats{
            Vendor: testkitv1.EmailVendor(v.GetVendor()),
            Total:  v.GetTotal(),
            Sent:   v.GetSent(),
            Failed: v.GetFailed(),
        })
    }
    return &testkitv1.EmailStatsResponse{
        Total:       r.GetTotal(),
        Sent:        r.GetSent(),
        Failed:      r.GetFailed(),
        SuccessRate: r.GetSuccessRate(),
        Vendors:     vendors,
    }
}

func toTestkitSMSStatsResponse(r *messagev1.SMSStatsResponse) *testkitv1.SMSStatsResponse {
    if r == nil {
        return nil
    }
    vendors := make([]*testkitv1.SmsVendorStats, 0, len(r.GetVendors()))
    for _, v := range r.GetVendors() {
        vendors = append(vendors, &testkitv1.SmsVendorStats{
            Vendor: testkitv1.SmsVendor(v.GetVendor()),
            Total:  v.GetTotal(),
            Sent:   v.GetSent(),
            Failed: v.GetFailed(),
        })
    }
    return &testkitv1.SMSStatsResponse{
        Total:       r.GetTotal(),
        Sent:        r.GetSent(),
        Failed:      r.GetFailed(),
        SuccessRate: r.GetSuccessRate(),
        Vendors:     vendors,
    }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/message/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/service/message/
git commit -m "feat(message): GetEmailStats/GetSMSStats with per-vendor breakdown"
```

---

## Task 9: message 域 Lookups（ListEmailSenders + ListSMSSenders + ListSMSRegions）

三个下拉数据源 RPC，结构简单（返回字符串列表），同一 Task 一起做。

**Files:**
- Modify: `internal/service/message/message.go`
- Modify: `internal/service/message/message_test.go`

- [ ] **Step 1: 测试补 Lookups（stub override + 测试）**

stub override：

```go
func (s *stubMessageClient) ListEmailSenders(ctx context.Context, req *messagev1.ListEmailSendersRequest) (*messagev1.ListEmailSendersResponse, error) {
    s.listEmailSendersReq = req
    return s.listEmailSendersResp, s.listEmailSendersErr
}
func (s *stubMessageClient) ListSMSSenders(ctx context.Context, req *messagev1.ListSMSSendersRequest) (*messagev1.ListSMSSendersResponse, error) {
    s.listSMSSendersReq = req
    return s.listSMSSendersResp, s.listSMSSendersErr
}
func (s *stubMessageClient) ListSMSRegions(ctx context.Context, req *messagev1.ListSMSRegionsRequest) (*messagev1.ListSMSRegionsResponse, error) {
    s.listSMSRegionsReq = req
    return s.listSMSRegionsResp, s.listSMSRegionsErr
}
```

测试函数：

```go
func TestListEmailSenders(t *testing.T) {
    stub := &stubMessageClient{listEmailSendersResp: &messagev1.ListEmailSendersResponse{
        SenderIds: []string{"testkit-service", "user-service"},
    }}
    svc := message.New(stub, message.WithSenderID("tk"))

    got, err := svc.ListEmailSenders(context.Background(), &testkitv1.ListEmailSendersRequest{})
    require.NoError(t, err)
    require.Equal(t, []string{"testkit-service", "user-service"}, got.GetSenderIds())
}

func TestListSMSSenders(t *testing.T) {
    stub := &stubMessageClient{listSMSSendersResp: &messagev1.ListSMSSendersResponse{
        SenderIds: []string{"testkit-service"},
    }}
    svc := message.New(stub, message.WithSenderID("tk"))

    got, err := svc.ListSMSSenders(context.Background(), &testkitv1.ListSMSSendersRequest{})
    require.NoError(t, err)
    require.Equal(t, []string{"testkit-service"}, got.GetSenderIds())
}

func TestListSMSRegions(t *testing.T) {
    stub := &stubMessageClient{listSMSRegionsResp: &messagev1.ListSMSRegionsResponse{
        RegionCodes: []string{"CN", "US", "HK"},
    }}
    svc := message.New(stub, message.WithSenderID("tk"))

    got, err := svc.ListSMSRegions(context.Background(), &testkitv1.ListSMSRegionsRequest{})
    require.NoError(t, err)
    require.Equal(t, []string{"CN", "US", "HK"}, got.GetRegionCodes())
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/message/...
```

Expected: FAIL。

- [ ] **Step 3: 实现 Lookup 方法**

`Service` 方法（请求为空 message，直接 new）：

```go
// ListEmailSenders returns distinct sender_id values for email filter dropdowns.
func (s *Service) ListEmailSenders(ctx context.Context, req *testkitv1.ListEmailSendersRequest) (*testkitv1.ListEmailSendersResponse, error) {
    resp, err := s.messageClient.ListEmailSenders(ctx, &messagev1.ListEmailSendersRequest{})
    if err != nil {
        return nil, err
    }
    return &testkitv1.ListEmailSendersResponse{SenderIds: resp.GetSenderIds()}, nil
}

// ListSMSSenders returns distinct sender_id values for SMS filter dropdowns.
func (s *Service) ListSMSSenders(ctx context.Context, req *testkitv1.ListSMSSendersRequest) (*testkitv1.ListSMSSendersResponse, error) {
    resp, err := s.messageClient.ListSMSSenders(ctx, &messagev1.ListSMSSendersRequest{})
    if err != nil {
        return nil, err
    }
    return &testkitv1.ListSMSSendersResponse{SenderIds: resp.GetSenderIds()}, nil
}

// ListSMSRegions returns distinct region_code values for SMS filter dropdowns.
func (s *Service) ListSMSRegions(ctx context.Context, req *testkitv1.ListSMSRegionsRequest) (*testkitv1.ListSMSRegionsResponse, error) {
    resp, err := s.messageClient.ListSMSRegions(ctx, &messagev1.ListSMSRegionsRequest{})
    if err != nil {
        return nil, err
    }
    return &testkitv1.ListSMSRegionsResponse{RegionCodes: resp.GetRegionCodes()}, nil
}
```

- [ ] **Step 4: 运行全包测试，确认通过**

```bash
go test ./internal/service/message/...
```

Expected: PASS（本域全部 13 个方法至此齐备，所有测试绿）。

- [ ] **Step 5: Commit**

```bash
git add internal/service/message/
git commit -m "feat(message): lookup RPCs (senders/regions dropdown sources)"
```

---

## Task 10: service.go wiring + handler 一行委托

把 `msgcore.Service` 接进 `internal/service/service.go`，校验 `cfg.Message.SenderID` 非空（fail-fast），在 `pkg/handler/testkit.go` 加 13 个薄壳。

**Files:**
- Modify: `internal/service/service.go`
- Modify: `pkg/handler/testkit.go`

- [ ] **Step 1: service.go 接线 message 域**

在 `internal/service/service.go` 的 import 区加（注意别名——决策 10）：

```go
import (
    // ... existing ...
    msgcore "github.com/servekit/testkit-service/internal/service/message"
    "github.com/servekit/testkit-service/pkg/xcodes"
)
```

`Service` struct 加字段：

```go
type Service struct {
    // ... existing (cfg, mgr, db, redis, user/storage/message/gid thirdcall handlers, auth, ...) ...
    messageSvc *msgcore.Service // P4 message domain (facade via Message()).
}
```

在 `New()` 里、四个 thirdcall module 构造完成之后（`resolveDownstreams` 返回 `s` 后、return 前），加构造 + 校验：

```go
    // P4 message domain: wrap the embedded message handler + inject sender_id.
    if cfg.Message == nil || cfg.Message.SenderID == "" {
        return nil, errors.Join(xcodes.ErrSenderNotConfigured.New(), mgr.Stop())
    }
    s.messageSvc = msgcore.New(s.message, msgcore.WithSenderID(cfg.Message.SenderID))
```

> 注：`s.message` 是 P1 Task 8 建的 thirdcall `*message.Handler`（import path `internal/thirdcall/message`）。`*message.Handler` 实现了 `messagev1.MessageServiceServer`，故满足 `msgcore.MessageClient` 接口（13 方法），可直接传入 `msgcore.New`。若 P2/P3 已把 thirdcall 字段统一加 `Hdl` 后缀（如 `messageHdl`），此处同步用 `s.messageHdl`。

facade 方法（与 P1 `Auth()` / P3 `Storage()` 同风格）：

```go
// Message exposes the message domain (P4).
func (s *Service) Message() *msgcore.Service { return s.messageSvc }
```

- [ ] **Step 2: handler 加 13 个一行委托**

在 `pkg/handler/testkit.go` 的 `Handler` 上加（每个方法一行委托给 `h.svc.Message()`）：

```go
// ---- Message (P4) ----

func (h *Handler) SendEmail(ctx context.Context, req *testkitv1.SendEmailRequest) (*testkitv1.SendResponse, error) {
    return h.svc.Message().SendEmail(ctx, req)
}
func (h *Handler) SendSMS(ctx context.Context, req *testkitv1.SendSMSRequest) (*testkitv1.SendResponse, error) {
    return h.svc.Message().SendSMS(ctx, req)
}
func (h *Handler) GetEmail(ctx context.Context, req *testkitv1.GetEmailRequest) (*testkitv1.EmailRecord, error) {
    return h.svc.Message().GetEmail(ctx, req)
}
func (h *Handler) ListEmails(ctx context.Context, req *testkitv1.ListEmailsRequest) (*testkitv1.ListEmailsResponse, error) {
    return h.svc.Message().ListEmails(ctx, req)
}
func (h *Handler) ListEmailsByCursor(ctx context.Context, req *testkitv1.ListEmailsByCursorRequest) (*testkitv1.ListEmailsByCursorResponse, error) {
    return h.svc.Message().ListEmailsByCursor(ctx, req)
}
func (h *Handler) GetEmailStats(ctx context.Context, req *testkitv1.GetEmailStatsRequest) (*testkitv1.EmailStatsResponse, error) {
    return h.svc.Message().GetEmailStats(ctx, req)
}
func (h *Handler) ListEmailSenders(ctx context.Context, req *testkitv1.ListEmailSendersRequest) (*testkitv1.ListEmailSendersResponse, error) {
    return h.svc.Message().ListEmailSenders(ctx, req)
}
func (h *Handler) GetSMS(ctx context.Context, req *testkitv1.GetSMSRequest) (*testkitv1.SMSRecord, error) {
    return h.svc.Message().GetSMS(ctx, req)
}
func (h *Handler) ListSMS(ctx context.Context, req *testkitv1.ListSMSRequest) (*testkitv1.ListSMSResponse, error) {
    return h.svc.Message().ListSMS(ctx, req)
}
func (h *Handler) ListSMSByCursor(ctx context.Context, req *testkitv1.ListSMSByCursorRequest) (*testkitv1.ListSMSByCursorResponse, error) {
    return h.svc.Message().ListSMSByCursor(ctx, req)
}
func (h *Handler) GetSMSStats(ctx context.Context, req *testkitv1.GetSMSStatsRequest) (*testkitv1.SMSStatsResponse, error) {
    return h.svc.Message().GetSMSStats(ctx, req)
}
func (h *Handler) ListSMSRegions(ctx context.Context, req *testkitv1.ListSMSRegionsRequest) (*testkitv1.ListSMSRegionsResponse, error) {
    return h.svc.Message().ListSMSRegions(ctx, req)
}
func (h *Handler) ListSMSSenders(ctx context.Context, req *testkitv1.ListSMSSendersRequest) (*testkitv1.ListSMSSendersResponse, error) {
    return h.svc.Message().ListSMSSenders(ctx, req)
}
```

- [ ] **Step 3: 验证编译 + 全量测试**

```bash
cd /Users/moss/code/servekit/testkit-service
go build ./...
go test -race ./...
```

Expected: PASS（`go build` 通过——handler/service 实现了全部 testkitv1 RPC；全量测试绿）。

- [ ] **Step 4: Commit**

```bash
git add internal/service/service.go pkg/handler/testkit.go
git commit -m "feat(handler): wire 13 message RPCs through service facade"
```

---

## Task 11: 前端 openapi 重生 + 发送邮件页 + 路由

**Files:**
- Modify: `web/config/routes.ts`
- Create: `web/src/pages/Message/SendEmail/index.tsx`

- [ ] **Step 1: 重生 services（消费 P4 新 RPC）**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto                              # 重生 testkit.swagger.json（含 P4 message RPC）
cd web
npm run openapi                         # swagger2openapi 2.0→3.0 + max openapi → src/services/testkit/
```

Expected: `web/src/services/testkit/index.ts` 含 `sendEmail` / `sendSMS` / `getEmail` / `listEmails` / `listEmailsByCursor` / `getEmailStats` / `listEmailSenders` / `getSMS` / `listSMS` / `listSMSByCursor` / `getSMSStats` / `listSMSRegions` / `listSMSSenders`（函数名 = operationId camelCase，以实际产物为准）。`typings.d.ts` 含 `API.SendEmailRequest` / `API.EmailRecord` 等类型。

- [ ] **Step 2: routes.ts 加 /message 路由**

`web/config/routes.ts` 在已有菜单树（P1-P3 的工作台/用户/文件）加：

```ts
{
  path: '/message',
  name: '消息管理',
  icon: 'mail',
  access: 'canInternal', // ops 控制台（发邮件/短信 + 全量记录），仅内部账号；后端不做鉴权（v2 §3.5）
  routes: [
    { path: '/message/send/email', name: '发送邮件', component: './Message/SendEmail' },
    { path: '/message/send/sms', name: '发送短信', component: './Message/SendSMS' },
    { path: '/message/emails', name: '邮件记录', component: './Message/Emails' },
    { path: '/message/sms', name: '短信记录', component: './Message/SMS' },
  ],
},
```

- [ ] **Step 3: 写发送邮件页（ProForm）**

`web/src/pages/Message/SendEmail/index.tsx`：

```tsx
import { ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormList } from '@ant-design/pro-components';
import { Card, message as antdMessage } from 'antd';
import { sendEmail } from '@/services/testkit';

const EMAIL_VENDORS = [
  { label: '默认（自动）', value: 'EMAIL_VENDOR_UNSPECIFIED' },
  { label: '阿里云', value: 'EMAIL_VENDOR_ALIYUN' },
  { label: '腾讯云', value: 'EMAIL_VENDOR_TENCENT' },
  { label: '网易', value: 'EMAIL_VENDOR_NETEASE' },
];
const EMAIL_SCENES = [
  { label: '登录验证码', value: 'EMAIL_SCENE_LOGIN_CODE' },
  { label: '忘记密码', value: 'EMAIL_SCENE_FORGOT_PASSWORD' },
  { label: '注册', value: 'EMAIL_SCENE_REGISTER' },
  { label: '修改密码', value: 'EMAIL_SCENE_CHANGE_PASSWORD' },
  { label: '绑定账号', value: 'EMAIL_SCENE_BIND_ACCOUNT' },
  { label: '通知', value: 'EMAIL_SCENE_NOTIFICATION' },
  { label: '验证邮箱', value: 'EMAIL_SCENE_VERIFY_EMAIL' },
];

export default function SendEmailPage() {
  return (
    <Card title="发送邮件" bordered={false}>
      <ProForm
        layout="vertical"
        onFinish={async (vals) => {
          // 组装 API.SendEmailRequest（sender_id 不在前端——BFF 从 config 注入）
          const payload = {
            to: (vals.to ?? []).map((r: any) => ({ email: r.email, display_name: r.display_name })),
            cc: (vals.cc ?? []).map((r: any) => ({ email: r.email })),
            bcc: (vals.bcc ?? []).map((r: any) => ({ email: r.email })),
            subject: vals.subject,
            body: vals.body,
            html_body: vals.html_body,
            scene: vals.scene,
            vendor: vals.vendor === 'EMAIL_VENDOR_UNSPECIFIED' ? undefined : vals.vendor,
            account: vals.account || '',
            idempotency_key: vals.idempotency_key,
            attachments: (vals.attachments ?? []).map((a: any) => ({
              filename: a.filename,
              url: a.url,
              size_bytes: Number(a.size_bytes) || 0,
            })),
          };
          try {
            const resp = await sendEmail(payload);
            antdMessage.success(`发送成功 id=${resp.id} 状态=${resp.status}`);
            return true;
          } catch {
            return false; // request 拦截器已弹错误 + 处理 401
          }
        }}
        submitter={{ searchConfig: { submitText: '发送' } }}
      >
        <ProFormList
          name="to"
          label="收件人（至少一个）"
          initialValue={[{}]}
          min={1}
          creatorButtonProps={{ creatorButtonText: '添加收件人' }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <ProFormText name="email" placeholder="邮箱" rules={[{ required: true, type: 'email' }]} />
            <ProFormText name="display_name" placeholder="显示名（可选）" />
          </div>
        </ProFormList>

        <ProFormList name="cc" label="抄送（可选）" creatorButtonProps={{ creatorButtonText: '添加抄送' }}>
          <ProFormText name="email" placeholder="邮箱" rules={[{ type: 'email' }]} />
        </ProFormList>

        <ProFormText name="subject" label="主题" rules={[{ required: true }]} />
        <ProFormTextArea name="body" label="纯文本正文" />
        <ProFormTextArea name="html_body" label="HTML 正文（可选）" />

        <div style={{ display: 'flex', gap: 8 }}>
          <ProFormSelect name="scene" label="业务场景" options={EMAIL_SCENES} rules={[{ required: true }]} />
          <ProFormSelect name="vendor" label="供应商（可选）" options={EMAIL_VENDORS} />
          <ProFormText name="account" label="账号（与供应商成对）" placeholder="留空走默认" />
        </div>

        <ProFormText name="idempotency_key" label="幂等键（可选，UUID）" placeholder="重试同一逻辑发送填同一值" />

        <ProFormList
          name="attachments"
          label="附件（URL；大文件用 OSS 预签名）"
          creatorButtonProps={{ creatorButtonText: '添加附件' }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <ProFormText name="filename" placeholder="文件名" rules={[{ required: true }]} />
            <ProFormText name="url" placeholder="https://..." rules={[{ required: true, type: 'url' }]} />
            <ProFormText name="size_bytes" placeholder="字节数（可选）" />
          </div>
        </ProFormList>
      </ProForm>
    </Card>
  );
}
```

> 注：`sendEmail` / 类型名以 `npm run openapi` 实际产物为准（P1 Task 17 同款约定）。proto enum 在 swagger 以 name 字符串表示，前端直接传 `'EMAIL_SCENE_NOTIFICATION'`。`sender_id` 不出现在表单——BFF 注入（决策 1）。

- [ ] **Step 4: 前端构建验证 + Commit**

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm run build
git add web/config/routes.ts web/src/pages/Message/SendEmail/ web/src/services/testkit/
git commit -m "feat(web): Send Email page (ProForm) + message routes + regenerated services"
```

---

## Task 12: 前端发送短信页

**Files:**
- Create: `web/src/pages/Message/SendSMS/index.tsx`

- [ ] **Step 1: 写发送短信页（ProForm，按 region 切换 CN 模板 / 海外 content）**

`web/src/pages/Message/SendSMS/index.tsx`：

```tsx
import { ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormDependency } from '@ant-design/pro-components';
import { Card, message as antdMessage } from 'antd';
import { sendSMS } from '@/services/testkit';

const SMS_VENDORS = [
  { label: '默认（按区号路由）', value: 'SMS_VENDOR_UNSPECIFIED' },
  { label: '阿里云', value: 'SMS_VENDOR_ALIYUN' },
  { label: '腾讯云', value: 'SMS_VENDOR_TENCENT' },
  { label: '火山引擎', value: 'SMS_VENDOR_VOLCENGINE' },
  { label: 'Byteplus', value: 'SMS_VENDOR_BYTEPLUS' },
  { label: '华为云', value: 'SMS_VENDOR_HUAWEI' },
];
const SMS_SCENES = [
  { label: '登录验证码', value: 'SMS_SCENE_LOGIN_CODE' },
  { label: '忘记密码', value: 'SMS_SCENE_FORGOT_PASSWORD' },
  { label: '注册', value: 'SMS_SCENE_REGISTER' },
  { label: '修改密码', value: 'SMS_SCENE_CHANGE_PASSWORD' },
  { label: '绑定账号', value: 'SMS_SCENE_BIND_ACCOUNT' },
  { label: '验证手机', value: 'SMS_SCENE_VERIFY_PHONE' },
];

export default function SendSMSPage() {
  return (
    <Card title="发送短信" bordered={false}>
      <ProForm
        layout="vertical"
        onFinish={async (vals) => {
          const isCN = vals.region_code === 'CN';
          const payload = {
            region_code: vals.region_code,
            phone: vals.phone,
            // CN：模板路径；海外：raw content 路径（二选一，下游校验 XOR）
            content: isCN ? '' : vals.content,
            template_id: isCN ? vals.template_id : '',
            template_params: vals.template_params ? JSON.parse(vals.template_params) : {},
            scene: vals.scene,
            sign_name: vals.sign_name,
            vendor: vals.vendor === 'SMS_VENDOR_UNSPECIFIED' ? undefined : vals.vendor,
            account: vals.account || '',
            idempotency_key: vals.idempotency_key,
          };
          try {
            const resp = await sendSMS(payload);
            antdMessage.success(`发送成功 id=${resp.id} 状态=${resp.status}`);
            return true;
          } catch {
            return false;
          }
        }}
        submitter={{ searchConfig: { submitText: '发送' } }}
        initialValues={{ region_code: 'CN' }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <ProFormText name="region_code" label="区域码（ISO alpha-2）" rules={[{ required: true, pattern: /^[A-Z]{2}$/ }]} />
          <ProFormText name="phone" label="手机号（本地号，无 +）" rules={[{ required: true }]} />
        </div>
        <ProFormSelect name="scene" label="业务场景" options={SMS_SCENES} rules={[{ required: true }]} />
        <ProFormText name="sign_name" label="签名（CN 必填）" rules={[{ required: true }]} />

        {/* CN：模板路径 */}
        <ProFormDependency name={['region_code']}>
          {({ region_code }) =>
            region_code === 'CN' ? (
              <>
                <ProFormText name="template_id" label="模板 ID（必填）" rules={[{ required: true }]} />
                <ProFormTextArea name="template_params" label="模板参数 JSON（如 {\"code\":\"123456\"}）" />
              </>
            ) : (
              <ProFormTextArea name="content" label="正文（海外 raw 内容）" rules={[{ required: true }]} />
            )
          }
        </ProFormDependency>

        <div style={{ display: 'flex', gap: 8 }}>
          <ProFormSelect name="vendor" label="供应商（可选）" options={SMS_VENDORS} />
          <ProFormText name="account" label="账号（与供应商成对）" placeholder="留空自动路由" />
        </div>
        <ProFormText name="idempotency_key" label="幂等键（可选）" />
      </ProForm>
    </Card>
  );
}
```

- [ ] **Step 2: 构建验证 + Commit**

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm run build
git add web/src/pages/Message/SendSMS/
git commit -m "feat(web): Send SMS page with CN-template/intl-content path switch"
```

---

## Task 13: 前端邮件记录页（ProTable offset + cursor 切换 + stats + senders）

同时演示两个分页模式（用户要求：ListEmails 偏移 + ListEmailsByCursor 游标都 fully worked）：默认 offset 用 `listEmails`；开关切到 cursor 用 `listEmailsByCursor` + 「加载更多」。

**Files:**
- Create: `web/src/pages/Message/Emails/index.tsx`

- [ ] **Step 1: 写邮件记录页**

`web/src/pages/Message/Emails/index.tsx`：

```tsx
import { useRef, useState, useEffect } from 'react';
import { ProTable, ProFormSelect, ProFormText, ProFormDateTimeRangePicker, Modal, Statistic, Switch, Button, Space, Tag } from '@ant-design/pro-components';
import { Card, Drawer, Descriptions } from 'antd';
import { listEmails, listEmailsByCursor, getEmail, getEmailStats, listEmailSenders } from '@/services/testkit';

const STATUS_TAG: Record<string, string> = {
  MESSAGE_STATUS_SENT: 'green', MESSAGE_STATUS_FAILED: 'red', MESSAGE_STATUS_PENDING: 'orange',
};

export default function EmailRecordsPage() {
  const tableRef = useRef();
  const [cursorMode, setCursorMode] = useState(false);
  const [cursorRecords, setCursorRecords] = useState<any[]>([]);
  const [nextToken, setNextToken] = useState('');
  const [cursorTotal, setCursorTotal] = useState<number | undefined>(undefined);
  const [senders, setSenders] = useState<string[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);

  // 发送方下拉（页面加载时拉一次，给 target/scene 过滤无关但便于审计回显）
  useEffect(() => {
    listEmailSenders({}).then((r: any) => setSenders(r.sender_ids ?? []));
  }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80, copyable: true },
    { title: '供应商', dataIndex: 'vendor', width: 100 },
    { title: '场景', dataIndex: 'scene', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100,
      render: (_: any, row: any) => <Tag color={STATUS_TAG[row.status] ?? 'default'}>{row.status}</Tag> },
    { title: '收件人', dataIndex: ['target', 'email'], width: 200, copyable: true },
    { title: '主题', dataIndex: 'subject', ellipsis: true },
    { title: '发送方', dataIndex: 'sender_id', width: 140 },
    { title: '发送时间', dataIndex: 'sent_at', width: 160,
      render: (v: number) => (v ? new Date(v).toLocaleString() : '-') },
    { title: '操作', width: 120, valueType: 'option',
      render: (_: any, row: any) => [
        <a key="d" onClick={async () => {
          const r = await getEmail({ id: row.id });
          setDetail(r);
        }}>详情</a>,
      ] },
  ];

  return (
    <Card
      extra={
        <Space>
          <span>offset</span>
          <Switch checked={cursorMode} onChange={(c) => { setCursorMode(c); setCursorRecords([]); setNextToken(''); }} />
          <span>cursor</span>
          <Button onClick={async () => {
            const r = await getEmailStats({});
            setStats(r);
          }}>统计</Button>
        </Space>
      }
    >
      {!cursorMode ? (
        <ProTable<any>
          actionRef={tableRef as any}
          rowKey="id"
          columns={columns}
          search={{
            filterType: 'light',
            form: { columns: 3 },
            optionRender: (_, { form }) => [
              { label: '查询', onClick: () => form?.submit() },
            ],
          }}
          request={async (params) => {
            // ProTable 分页参数 + 搜索过滤
            const resp = await listEmails({
              vendor: params.vendor, scene: params.scene, status: params.status,
              target: params.target,
              page: params.current ?? 1, page_size: params.pageSize ?? 20,
              sort_field: 'SORT_FIELD_CREATED_AT', sort_direction: 'SORT_DIRECTION_DESC',
            });
            return { data: resp.records ?? [], success: true, total: resp.total ?? 0 };
          }}
        />
      ) : (
        <div>
          <ProTable<any>
            rowKey="id"
            columns={columns}
            search={false}
            pagination={false}
            dataSource={cursorRecords}
            toolBarRender={false}
            loading={false}
          />
          <Space style={{ marginTop: 16 }}>
            <Button
              disabled={!nextToken}
              onClick={async () => {
                const isFirst = cursorRecords.length === 0;
                const r = await listEmailsByCursor({
                  page_size: 20,
                  page_token: nextToken,
                  include_total: isFirst,
                  sort_field: 'SORT_FIELD_CREATED_AT',
                });
                setCursorRecords([...cursorRecords, ...(r.records ?? [])]);
                setNextToken(r.next_page_token ?? '');
                if (isFirst) setCursorTotal(r.total);
              }}
            >
              {cursorRecords.length === 0 ? '加载首页' : '加载更多'}
            </Button>
            {cursorTotal !== undefined && <span>总数 {cursorTotal}</span>}
            {!nextToken && cursorRecords.length > 0 && <span>已到末页</span>}
          </Space>
        </div>
      )}

      {/* 详情抽屉 */}
      <Drawer open={!!detail} onClose={() => setDetail(null)} width={640} title="邮件详情">
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="状态">{detail.status}</Descriptions.Item>
            <Descriptions.Item label="收件人">{detail.target?.email}</Descriptions.Item>
            <Descriptions.Item label="主题">{detail.subject}</Descriptions.Item>
            <Descriptions.Item label="正文">{detail.content}</Descriptions.Item>
            <Descriptions.Item label="错误信息">{detail.error_message || '-'}</Descriptions.Item>
            <Descriptions.Item label="尝试次数">{detail.attempts}</Descriptions.Item>
            <Descriptions.Item label="附件">{(detail.attachments ?? []).map((a: any) => a.filename).join(', ') || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 统计弹窗 */}
      <Modal open={!!stats} onCancel={() => setStats(null)} onOk={() => setStats(null)} title="邮件统计" footer={null} width={720}>
        {stats && (
          <div>
            <Space size="large">
              <Statistic title="总数" value={stats.total} />
              <Statistic title="成功" value={stats.sent} valueStyle={{ color: 'green' }} />
              <Statistic title="失败" value={stats.failed} valueStyle={{ color: 'red' }} />
              <Statistic title="成功率" value={stats.success_rate < 0 ? '-' : stats.success_rate} suffix="%" />
            </Space>
            <ProTable<any>
              rowKey="vendor"
              size="small"
              search={false}
              pagination={false}
              dataSource={stats.vendors ?? []}
              columns={[
                { title: '供应商', dataIndex: 'vendor' },
                { title: '总数', dataIndex: 'total' },
                { title: '成功', dataIndex: 'sent' },
                { title: '失败', dataIndex: 'failed' },
              ]}
            />
          </div>
        )}
      </Modal>
    </Card>
  );
}
```

> 注：
> - offset 模式用 `listEmails` + ProTable 原生分页；cursor 模式用 `listEmailsByCursor` + 手动「加载更多」（ProTable 分页是页号制，不适合游标，故 cursor 下 `pagination={false}` + 累加 `dataSource`）。
> - `sender_id` 过滤不下发（决策 2）；发送方下拉仅做审计回显/快速筛选保留（实现期若需可加到 `target` 之外的客户端二次过滤）。
> - 实际生成的 service 函数名/参数形状以 `npm run openapi` 产物为准（GET 请求 query 参数通常合并成一个 params 对象）。

- [ ] **Step 2: 构建验证 + Commit**

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm run build
git add web/src/pages/Message/Emails/
git commit -m "feat(web): Email records page (offset + cursor + stats + detail)"
```

---

## Task 14: 前端短信记录页（ProTable + stats + regions/senders 下拉）

**Files:**
- Create: `web/src/pages/Message/SMS/index.tsx`

- [ ] **Step 1: 写短信记录页**

`web/src/pages/Message/SMS/index.tsx`：

```tsx
import { useEffect, useState } from 'react';
import { ProTable, Modal, Statistic, Space, Tag, Drawer, Descriptions } from '@ant-design/pro-components';
import { Card } from 'antd';
import { listSMS, getSMS, getSMSStats, listSMSRegions, listSMSSenders } from '@/services/testkit';

const STATUS_TAG: Record<string, string> = {
  MESSAGE_STATUS_SENT: 'green', MESSAGE_STATUS_FAILED: 'red', MESSAGE_STATUS_PENDING: 'orange',
};

export default function SMSRecordsPage() {
  const [regions, setRegions] = useState<string[]>([]);
  const [senders, setSenders] = useState<string[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);

  useEffect(() => {
    listSMSRegions({}).then((r: any) => setRegions(r.region_codes ?? []));
    listSMSSenders({}).then((r: any) => setSenders(r.sender_ids ?? []));
  }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80, copyable: true },
    { title: '供应商', dataIndex: 'vendor', width: 110 },
    { title: '场景', dataIndex: 'scene', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100,
      render: (_: any, row: any) => <Tag color={STATUS_TAG[row.status] ?? 'default'}>{row.status}</Tag> },
    { title: '区域', dataIndex: 'region_code', width: 70 },
    { title: '手机号', dataIndex: 'phone', width: 140, copyable: true },
    { title: '发送方', dataIndex: 'sender_id', width: 140 },
    { title: '发送时间', dataIndex: 'sent_at', width: 160,
      render: (v: number) => (v ? new Date(v).toLocaleString() : '-') },
    { title: '操作', width: 120, valueType: 'option',
      render: (_: any, row: any) => [
        <a key="d" onClick={async () => { const r = await getSMS({ id: row.id }); setDetail(r); }}>详情</a>,
      ] },
  ];

  return (
    <Card
      extra={
        <Space>
          <a onClick={async () => { const r = await getSMSStats({}); setStats(r); }}>统计</a>
        </Space>
      }
    >
      <ProTable<any>
        rowKey="id"
        columns={columns}
        search={{ filterType: 'light' }}
        request={async (params) => {
          const resp = await listSMS({
            vendor: params.vendor, scene: params.scene, status: params.status,
            region_code: params.region_code, phone: params.phone,
            page: params.current ?? 1, page_size: params.pageSize ?? 20,
            sort_field: 'SORT_FIELD_CREATED_AT', sort_direction: 'SORT_DIRECTION_DESC',
          });
          return { data: resp.records ?? [], success: true, total: resp.total ?? 0 };
        }}
      />

      <Drawer open={!!detail} onClose={() => setDetail(null)} width={560} title="短信详情">
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="状态">{detail.status}</Descriptions.Item>
            <Descriptions.Item label="区域/手机">{detail.region_code} {detail.phone}</Descriptions.Item>
            <Descriptions.Item label="正文">{detail.content}</Descriptions.Item>
            <Descriptions.Item label="模板">{detail.template_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="错误">{detail.error_message || '-'}</Descriptions.Item>
            <Descriptions.Item label="尝试次数">{detail.attempts}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <Modal open={!!stats} onCancel={() => setStats(null)} footer={null} title="短信统计" width={720}>
        {stats && (
          <div>
            <Space size="large">
              <Statistic title="总数" value={stats.total} />
              <Statistic title="成功" value={stats.sent} valueStyle={{ color: 'green' }} />
              <Statistic title="失败" value={stats.failed} valueStyle={{ color: 'red' }} />
              <Statistic title="成功率" value={stats.success_rate < 0 ? '-' : stats.success_rate} suffix="%" />
            </Space>
            <ProTable<any>
              rowKey="vendor" size="small" search={false} pagination={false}
              dataSource={stats.vendors ?? []}
              columns={[
                { title: '供应商', dataIndex: 'vendor' },
                { title: '总数', dataIndex: 'total' },
                { title: '成功', dataIndex: 'sent' },
                { title: '失败', dataIndex: 'failed' },
              ]}
            />
            <div style={{ marginTop: 16 }}>
              <div>已知区域：{regions.join(', ') || '-'}</div>
              <div>已知发送方：{senders.join(', ') || '-'}</div>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
```

> 注：SMS 记录页用 offset（`listSMS`）做主表（与邮件页对称展示一种即可）；`listSMSByCursor` 已在后端实现并经 service 暴露，前端如需大表流式浏览可按 Task 13 的 cursor 模式同款改造。regions/senders 下拉数据来自 `listSMSRegions`/`listSMSSenders`。

- [ ] **Step 2: 构建验证 + Commit**

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm run build
git add web/src/pages/Message/SMS/
git commit -m "feat(web): SMS records page (table + stats + regions/senders lookups)"
```

---

## Task 15: 端到端验证（docker-compose 全栈）

**Files:** 无（运行验证）

- [ ] **Step 1: 全栈起栈 + 后端 lint/test**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto && git diff --exit-code          # 生成一致（gen/ + swagger/ 无残留 diff）
go build ./...
golangci-lint run ./...
go test -race -coverprofile=coverage.out ./...
```

Expected: 全绿；`go test ./internal/service/message/...` 覆盖 Send/SMS/Get/List/Cursor/Stats/Lookup + sender_id 注入断言。

- [ ] **Step 2: testkit.proto 自包含校验**

```bash
grep -n '^import' api/proto/testkit/v1/testkit.proto
# 仅命中 google/api/*、google/protobuf/*、buf/validate/*——无任何 message/user/storage/gid proto import
grep -c 'message-service/gen/message/v1' internal/service/message/message.go   # == 1（唯一引用 messagev1 的文件）
grep -rln 'message-service/gen/message/v1' internal/ pkg/                        # 仅 internal/service/message + internal/thirdcall/message 两处
```

Expected: proto import 区无下游 proto；`messagev1` 只被 `internal/service/message/message.go` + `internal/thirdcall/message/*` 引用（spec §3.4 依赖边界）。

- [ ] **Step 3: 前端 codegen 一致性 + 构建**

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm run openapi
git diff --exit-code src/services/testkit/        # 生成一致
npm run build
```

Expected: `src/services/testkit/` 含全部 13 个 message RPC 函数；构建通过。

- [ ] **Step 4: docker-compose 全栈 + 浏览器端到端**

```bash
cd /Users/moss/code/servekit/testkit-service
cp .env.example .env   # 首次
docker compose up --build -d
# 等 testkit-migrate 完成后 testkit 起来
curl -s http://localhost:18085/api/v1/health | head   # 200 + {"service":"testkit-service",...}
```

浏览器 `http://localhost:8080`：
1. 登录（P1）→ 拿 token 存 localStorage。
2. 「消息管理 → 发送邮件」→ 填收件人/主题/场景 → 发送 → 成功提示带 `id`/`status=SENT`。
3. 「邮件记录」→ offset 模式看到刚发的记录；切 cursor 模式「加载首页」也看到；点「统计」看 success_rate；点「详情」看完整字段。
4. 「发送短信」→ CN 区填签名+模板 → 发送；「短信记录」看到记录；统计/区域/发送方下拉有值。
5. 全程 Network 面板：每个请求 `Authorization: Bearer <token>`；请求体里**没有 `sender_id` 字段**（验证决策 1 落地）。

Expected: 端到端闭环通；前端 0 手写 fetch（全部走 `@/services/testkit`）。

- [ ] **Step 5: Commit（如有 e2e 修复）**

```bash
git add -A
git commit -m "test(message): end-to-end verification through docker-compose" || echo "nothing to commit"
```

---

## 验收检查（P4 完成时跑）

- [ ] `go build ./...` + `golangci-lint run ./...` 无 error
- [ ] `make proto && git diff --exit-code`（gen/ + api/swagger/ 一致）
- [ ] `go test -race ./...` 全绿；message 域测试覆盖 13 方法 + sender_id 注入断言
- [ ] testkit.proto **不 import 任何下游 proto**；`messagev1` 只被 `internal/service/message` + `internal/thirdcall/message` 引用
- [ ] `internal/service/message/message.go` 是唯一同时 import `testkitv1` + `messagev1` 的文件
- [ ] SendEmail/SendSMS 的 testkit request **无 sender_id 字段**（grep proto 确认）；converter 从 config 注入；List/Stats 不下发 sender_id 过滤
- [ ] 7 个枚举在 testkit 镜像下游同名同号（`grep -A20 'enum MessageStatus' api/proto/testkit/v1/testkit.proto`）
- [ ] 前端 `npm run openapi` 生成含全部 13 message RPC；邮件/短信页用生成 service、**无手写 fetch**
- [ ] `docker compose up --build -d` 全栈起来；浏览器发送→记录→统计闭环通；Network 请求无 sender_id
- [ ] service.go 的 import 别名（`msgcore`）+ 字段（`messageSvc`）+ accessor（`Message()`）不与 P1 thirdcall `message *message.Handler` 冲突

---

## Self-Review

**覆盖度对照 spec §7 / §8（P4 = message 域）**：
- spec §7 列 message 下游 14 RPC → testkit 暴露约 13（去 Ping）。本计划覆盖 **13/13**：Send×2 + Email 记录×5（GetEmail/ListEmails/ListEmailsByCursor/GetEmailStats/ListEmailSenders）+ SMS 记录×6（GetSMS/ListSMS/ListSMSByCursor/GetSMSStats/ListSMSRegions/ListSMSSenders）。
- 后端：每个 RPC 都有 stub-client 单测（test→FAIL→完整实现→PASS→commit），无占位；converter 覆盖正反两向 + 嵌套（EmailAddress/EmailAttachment/VendorStats）。
- 前端：发送×2 + 记录×2（offset+cursor+stats+lookups）fully worked，全部 import `@/services/testkit`。
- spec §3.2 curation：决策 1（sender_id 从 config 注入，含为什么不用 ctx user_id 的三点论证）、决策 2（List/Stats 不下发 sender_id 过滤，含与「BFF scope by user」泛式的偏离说明）、决策 3（Get 的 id 保留）、决策 5（嵌套 message 重新定义）、决策 6（SendResponse oneof→两字段）均有实现落点 + 测试断言。
- spec §9 错误处理：下游 xerr 透传（service 方法 `if err != nil { return nil, err }` 不吞错）；testkit 自身错误仅 `ErrSenderNotConfigured`（防御）。
- spec §3.4 依赖边界：`messagev1` 只被 `internal/service/message` + `internal/thirdcall/message` import；Task 15 Step 2 有 grep 断言。

**占位扫描**：
- Task 3 Step 1 的 `go.uber.org/mock/gomock` import 是占位提示——实现时删掉该行（本域用手工 stub，不引 gomock）。
- 无 `TODO` / `...implement...` / 伪代码；所有 Go/TS 代码块是完整可编译文本（命名/字段号/枚举值已对齐下游 proto）。
- 生成代码（`gen/`、`api/swagger/`、`web/src/services/testkit/`）均由 `make proto` / `npm run openapi` 产出，不手写。

**一致性**：
- 命名沿用 P3 约定：`toMessage<Method>Request` / `toTestkit<Entity>`，与 P3 的 `toStorage<Method>Request` / `toTestkit<Entity>` 对齐（P4 仅前缀换成 `Message`）。
- enum 镜像下游同名同号，映射整型直转（无查表）——与 P1 Task 12/13、P3 决策 2 一致。
- stub 测试技巧（embed `UnimplementedXxxServer`）沿用 P3 决策 7。
- service.go 字段冲突（thirdcall `message` vs domain `message`）用 import 别名 `msgcore` + 字段 `messageSvc` 解决，不破坏 P1 Task 8 已写的 `message *message.Handler`（决策 10 给出实现 + 可替换说明，便于和 P3 实际代码风格对齐）。

**潜在偏差（实现期需核对）**：
1. `go-common/xerr` 的 category 常量名以实际为准——本计划用 `xerr.CategoryInternal`（已核对 `/Users/moss/code/servekit/go-common/xerr/code.go`，存在该常量）。
2. 前端 `@umijs/openapi` 生成的函数名/参数形状（GET 合并 query 成 params、POST 取 body）以实际 `npm run openapi` 产物为准，页面 import 与调用处可能要微调大小写/对象包裹。
3. service.go 里 thirdcall handler 字段名：若 P2/P3 已统一加 `Hdl` 后缀，则 `s.message` 应读作 `s.messageHdl`（决策 10 已注明）。
4. message-service `EmailAttachment` 有 `reserved 1/7`；testkit 重排字段号无 reserved——映射靠字段名逐个赋值，不依赖字段号相同，正确。

---

## 关联

**设计文档：**
- `docs/superpowers/specs/2026-07-29-testkit-service-design.md`（v2，本计划据其 §3/§3.2/§7/§8；自包含 proto + 映射层 + swagger + 前端 codegen）

**前置 plan：**
- `docs/superpowers/plans/2026-07-28-testkit-service-p1-foundation.md`（P1 地基：thirdcall `internal/thirdcall/message`、`service.go` 骨架与 `message *message.Handler` 字段、handler 薄壳模式、openapi 管线、枚举镜像+int 直转约定）
- `docs/superpowers/plans/2026-07-29-testkit-service-p3-storage.md`（P3 文件域：converter 命名约定、stub embed 技巧、curation 决策格式——P4 风格基线）

**后续 plan：**
- P5 gid+仪表盘 → `docs/superpowers/plans/2026-07-29-testkit-service-p5-gid-dashboard.md`（其中 `GetDashboard` 聚合会并发调本域 `GetEmailStats` + `GetSMSStats`）
- P6 扩展 → `docs/superpowers/plans/2026-07-29-testkit-service-p6-extension.md`

**相关服务：**
- `message-service`（14 RPC / 30 message / 7 enum；`api/proto/message/v1/message.proto`、`gen/message/v1`、`pkg.NewModule`/`type Handler = handler.Handler`）

**遵循 skill：**
- `golang-service-development`（架构 / api-swagger / 迭代已有服务 quick-path）
- `proto-development`（proto 写法 / protovalidate / buf / 自包含不 import 下游）
- `golang-development`（Go 风格 / lint / 文件内函数排列：导出 API 在上、converters 在 `// --- converters ---` 下）
