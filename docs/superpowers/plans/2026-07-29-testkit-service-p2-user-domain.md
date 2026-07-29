# testkit-service P2（用户与权限域）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 P1 地基之上，把 user-service 的用户与权限域（54 个 RPC：profile / identity / session / social / admin-users / RBAC-group / RBAC-role / RBAC-permission）以「自包含裁剪 message + 映射层」的形式接入 testkit-service，并落地对应的前端运营页面，使 `npm run openapi` 能从 testkit.swagger.json 全量生成请求层。

**Architecture:** 沿用 P1 的自包含 proto + 映射层（v2 §3）。P2 在 `api/proto/testkit/v1/testkit.proto` 追加 54 个 RPC + 裁剪过的自有 message（不 import 下游 proto），在 `internal/service/user/user.go`（整个 testkit 唯一同时 import `testkitv1` 与 `uservl` 的文件）做 testkit-msg ↔ userv1-msg 翻译，在 `pkg/handler/testkit.go` 加一行委托，在 `internal/service/service.go` 持有 `*user.Service` 子服务。下游 client 复用 P1 已建好的 `internal/thirdcall/user`（`*user.Handler`，typed in `uservl`）。调用方自身 user_id 一律从 ctx（`grpcx.GetUserIDFromCtx`，P1 AuthInterceptor 注入）取，不在 request message 出现；目标资源 ID（admin 的 target user_id、group_id、role_id 等）保留在 message 里。

**Tech Stack:** Go 1.26 + go-common（grpcx/xerr/xcodes）+ buf v2 + grpc-gateway；前端 Ant Design Pro v6（React 19 + antd 6 + Umi Max 4 + ProComponents），请求层 100% 由 `npm run openapi` 从 `api/swagger/testkit/v1/testkit.swagger.json` 生成。

---

## 关键决策与 spec 偏差（实现前必读）

1. **「我的」类 RPC 去掉调用方 user_id，从 ctx 注入**（v2 §3.2 规则 1）。
   - 去掉的：`GetProfile` / `UpdateProfile` / `ChangePassword` / `ListIdentities` / `BindIdentity` / `BindOAuthIdentity` / `UnbindIdentity` / `ListSessions` / `RevokeAllSessions` 这 9 个 RPC 的 testkit request **不含 `user_id`**，service 域包用 `grpcx.GetUserIDFromCtx(ctx)` 取调用者 user_id 填入下游请求。
   - 保留的目标资源 ID：`GetUser`/`DisableUser`/`GetLoginLogs` 的 target `user_id`、`GetGroup`/`DeleteGroup`/... 的 `group_id`、`GetRole`/`DeleteRole` 的 `role_id`、`AssignRole`/`AddGroupMember` 的 target `user_id`、`GetSession`/`RevokeSession`/`IssueSessionCode` 的 `session_id`、`UnbindIdentity` 的 `identity_id`、`GetPermission*` 的 id 等——这些都是「操作谁/什么」，是合法请求字段。
   - 判定标准（v2 §3.2）：描述「谁在调用」→ 从 ctx 注入、字段不出现在 message；描述「操作谁/什么」→ 保留。

2. **枚举镜像下游同名同号**（P1 Task 12 模式）。P2 在 testkit.proto 重新定义：`UserStatus` / `Gender` / `DeviceType` / `LoginAction` / `UserSortField`（`IdentityProvider` / `LoginMethod` / `VerificationChannel` / `VerificationPurpose` / **`UserType`** 已在 P1——`UserType` 由 P1 拥有、P2 直接复用）。另：P1 的 `IdentityProvider` 只到 `IDENTITY_PROVIDER_WECHAT_MINIPROGRAM = 7`，而 user-service 还有 `IDENTITY_PROVIDER_ADMIN = 8`（CreateUser 审计标记、admin 列表 register_source 会出现），P2 Task 1 追加该值（enum 末尾追加，向后兼容）。映射用整型直转：`uservl.Gender(req.GetGender())`。

3. **`UserClient` 直接用 `uservl.UserServiceServer`，不手写 53 方法接口**（对 P1 Task 13 小接口模式的唯一偏离）。
   - 原因：P1 的 `auth.UserClient` 只列 5 个方法，手写可读；P2 需要 53 个方法，手写接口冗长且易腐。`*user.Handler`（internal/thirdcall/user）已实现完整 `uservl.UserServiceServer`，直接把 `user.Service.user` 字段类型定为 `uservl.UserServiceServer` 即可；测试 stub 内嵌 `uservl.UnimplementedUserServiceServer`（生成的 59 个方法默认返回 Unimplemented）后只覆写被测方法，可测性等价于 P1 的小接口。
   - 若执行者更偏好显式小接口：每个 worked task 可改为「在 UserClient 接口追加本 task 的方法」，最终接口清单见 Task 12 末尾。两者产物等价。

4. **admin 端点本期不做 RBAC 鉴权应用——仅登录态 + 身份注入**。
   - user-service 的 RBAC 现阶段**只做 CRUD**（管理角色/权限/组数据），不做鉴权落地；**后续权限控制统一用 OPA 规则引擎**（见 v2 spec §3.5 / §12 非目标）。
   - 故 testkit admin 端点（Admin-Users / RBAC 全域）**不叠加**任何 RBAC permission 校验：只做 (a) 登录态（过 AuthInterceptor）、(b) 身份注入（`user_id` 从 ctx）。前端 admin 页面对所有登录用户可见（不区分 admin/user 权限）。
   - **保留并做全的**：RBAC 的 CRUD 管理 UI（Task 5/11/12/13——角色/权限/组/成员/用户角色的增删改查 + 前端管理页），这是本期 RBAC 的全部目标。
   - 下游 user-service 自身对 ownership/状态做业务校验。OPA 接入是未来独立工作，**不在 P2 范围**（取消原先「Task 15 可选硬化」的说法）。
   - **双轨前端（按 UserType 分流页面，前端路由级、非 RBAC）**：`UserType` 由 P1 拥有（`User` message 含 `user_type`，登录响应即带）。P1 Task 17 的 `access.ts` 定义 `canInternal`（`user_type=INTERNAL`）/ `canUser`（任意登录），登录后按 user_type 跳首页（INTERNAL→`/dashboard`，NORMAL→`/profile`）。**P2 页面路由分流**（遵循 P1 约定）：自助类（profile / identity / sessions）→ `access: 'canUser'`；内部管理类（user admin：用户列表/禁用/登录日志；RBAC 全套管理）→ `access: 'canInternal'`。用户列表 + 资料页仍用 Tag 标注「内部/外部」（区分展示）。**后端不做 permission 校验**（RBAC 只 CRUD，后续 OPA；v2 §3.5）——这只是前端按 UserType 的页面/菜单区分。后续按 UserType 决定走 RBAC（内部）还是业务侧权限（外部）的逻辑按需再加。

5. **social 登录在 user 域签发 JWT**（不在 auth 域）。
   - `GetOAuthURL` / `SocialLogin` / `MiniProgramLogin` / `MiniProgramPhoneLogin` 归 P2 user 域，落在 `internal/service/user/user.go`。后三者下游返回 `session_id`，testkit 像 P1 的 Login 一样消费 session_id 签发 JWT、不把 session_id 回前端。因此 `user.New` 需要注入 `*jwt.Manager`（与 auth 域共享同一实例）。

6. **错误透传 + 复用 go-common 预置 xcodes**（v2 §9）。下游 `xerr.Error` 透传不重映射；testkit 自身错误（ctx 缺 user_id 等防御性检查）用 `xcodes.ErrUnauthorized`（go-common/xerr/xcodes 已预置，`xcodes.ErrUnauthorized.Wrap(err)`）。P2 不新增 testkit 自有错误码——`pkg/xcodes/user.go` 保留为未来 user 域专属码的位置，本期不创建空文件。

7. **proto 编辑方式**：所有 P2 RPC/message **追加**到 P1 已有的 `api/proto/testkit/v1/testkit.proto` 同一 `service TestKitService { ... }` 内。每次编辑后 `make proto`（重生 `gen/` + `api/swagger/testkit/v1/testkit.swagger.json`）；前端再 `npm run openapi`。

---

## File Structure

P2 涉及的文件（创建/修改）：

```
testkit-service/
├── api/proto/testkit/v1/testkit.proto        # 追加 P2 enums + entities + 54 RPC [改]
├── internal/service/user/user.go             # user 域：53 转发方法 + 映射 converters [建]
├── internal/service/user/user_test.go        # 映射 + 转发单测（stub client） [建]
├── internal/service/service.go               # 持有 *user.Service 子服务 + User() facade [改]
├── pkg/handler/testkit.go                    # 54 个一行委托 [改]
├── pkg/server.go                             # 公开 RPC 白名单追加（social/reset） [改]
└── web/
    ├── src/pages/Profile/                    # 个人资料页 [建]
    ├── src/pages/User/                       # 用户运营（列表/详情） [建]
    ├── src/pages/Identity/                   # 登录方式管理 [建]
    ├── src/pages/Session/                    # 会话管理 [建]
    ├── src/pages/Rbac/                       # 角色/权限/组/成员 [建]
    └── web/config/routes.ts                  # 菜单 + 路由 [改]
```

**职责边界**（与 P1 一致）：`internal/service/user/user.go` 是唯一 import `testkitv1` + `uservl` 的文件；`pkg/handler` 只见 `testkitv1`；`internal/thirdcall/user`（P1 已建）是唯一 import 下游 `pkg`/`gen` 做 client 接线的地方。

---

## RPC 清单（54 个，按子域）

> P2 = user-service 59 RPC − P1 已做的 5 个 auth RPC（Login/Register/SendVerificationCode/Logout/RefreshSession）。下表「ctx」列 = 该 RPC 的 testkit request 是否去掉调用方 user_id（Y=去掉，从 ctx 注入）；「目标 ID」列 = request 保留的目标资源 ID 字段。

| 子域 | RPC | ctx 注入 user_id | 保留目标 ID | REST |
|---|---|---|---|---|
| Profile | GetProfile / UpdateProfile / ChangePassword / ResetPassword | Y / Y / Y / −（公开，code 登录） | − | `/api/v1/profile`、`/api/v1/profile/password`、`/api/v1/auth/password-reset` |
| Identity | ListIdentities / BindIdentity / BindOAuthIdentity / UnbindIdentity | Y / Y / Y / Y | `identity_id`(Unbind) | `/api/v1/identities` |
| Session | ListSessions / RevokeSession / RevokeAllSessions / GetSession / IssueSessionCode / ExchangeSessionCode | Y / − / Y / − / − / − | `session_id`(Revoke/Get/Issue) | `/api/v1/sessions/*` |
| Social | GetOAuthURL / SocialLogin / MiniProgramLogin / MiniProgramPhoneLogin | − / − / − / − | −（公开） | `/api/v1/social/*` |
| Admin-Users | CreateUser / GetUser / ListUsers / ListUsersPaged / DisableUser / GetLoginLogs | − / − / − / − / − / − | `user_id`(Get/Disable target)；GetLoginLogs.user_id 是可选过滤 | `/api/v1/users/*` |
| RBAC-Group | CreateGroup / GetGroup / UpdateGroup / ListGroups / DeleteGroup / AddGroupMember / RemoveGroupMember / ListGroupMembers / AddGroupRole / RemoveGroupRole / ListGroupRoles | − | group_id / role_id / target user_id | `/api/v1/rbac/groups/*` |
| RBAC-Role | CreateRole / GetRole / UpdateRole / DeleteRole / ListRoles / AssignRole / RevokeRole / ListUserRoles | − | role_id / target user_id | `/api/v1/rbac/roles/*`、`/api/v1/rbac/users/{id}/roles` |
| RBAC-Permission | ListPermissions / Create/Get/Update/Delete Permission / Create/Get/Update/Delete/List PermissionGroups | − | permission_id / permission_group_id | `/api/v1/rbac/permissions*` |

合计 4+4+6+4+6+11+8+10 = **53** 个转发型 RPC（GetSession 为可选内部辅助，计入 Session 的 6）；外加 P1 的 5 = 58（user-service 的第 59 个是 Ping，testkit 自有 Ping 不转发）。

---

## Task 1: P2 共享 enums + 实体 message（proto only）

把 P2 所有 RPC 共享的镜像 enum 和实体 message 一次性加进 proto，使后续每个 worked task 只需追加自己的 request/response。`IdentityProvider` 末尾追加 `IDENTITY_PROVIDER_ADMIN = 8`。

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`

- [ ] **Step 1: 追加 P2 enums + 实体 message**

在 `testkit.proto` 的 P1 auth 段之后、`service TestKitService { ... }` 之前插入。**不要**重复定义 P1 已有的 `LoginMethod` / `IdentityProvider` / `VerificationChannel` / `VerificationPurpose`——仅给 `IdentityProvider` 末尾加一个值。

先改 `IdentityProvider`（在 P1 已有定义里追加一行）：

```proto
enum IdentityProvider {
  IDENTITY_PROVIDER_UNSPECIFIED = 0;
  IDENTITY_PROVIDER_EMAIL = 1;
  IDENTITY_PROVIDER_PHONE = 2;
  IDENTITY_PROVIDER_GITHUB = 3;
  IDENTITY_PROVIDER_GOOGLE = 4;
  IDENTITY_PROVIDER_WECHAT = 5;
  IDENTITY_PROVIDER_APPLE = 6;
  IDENTITY_PROVIDER_WECHAT_MINIPROGRAM = 7;
  IDENTITY_PROVIDER_ADMIN = 8;  // P2: audit tag for CreateUser; mirrors user-service.
}
```

再在 auth 段之后插入 P2 共享 enums + entities：

```proto
// ---- P2 shared enums (mirror user-service name-for-name, number-for-number) ----
// Conversion is a plain int cast: uservl.UserStatus(req.GetStatus()).

enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_DISABLED = 2;
  USER_STATUS_PENDING_REVIEW = 3;
}

enum Gender {
  GENDER_UNSPECIFIED = 0;
  GENDER_MALE = 1;
  GENDER_FEMALE = 2;
  GENDER_OTHER = 3;
  GENDER_UNKNOWN = 4;
}

enum DeviceType {
  DEVICE_TYPE_UNSPECIFIED = 0;
  DEVICE_TYPE_WEB = 1;
  DEVICE_TYPE_IOS = 2;
  DEVICE_TYPE_ANDROID = 3;
  DEVICE_TYPE_API = 4;
}

enum LoginAction {
  LOGIN_ACTION_UNSPECIFIED = 0;
  LOGIN_ACTION_LOGIN = 1;
  LOGIN_ACTION_REGISTER = 2;
  LOGIN_ACTION_SOCIAL_LOGIN = 3;
  LOGIN_ACTION_SOCIAL_REGISTER = 4;
  LOGIN_ACTION_BIND = 5;
  LOGIN_ACTION_UNBIND = 6;
}

// UserType 已在 P1 定义（P1 的 User message 含 user_type，登录即带）——本 Task 不重复声明，直接复用。

enum UserSortField {
  USER_SORT_FIELD_UNSPECIFIED = 0;
  USER_SORT_FIELD_ID = 1;
  USER_SORT_FIELD_CREATED_AT = 2;
  USER_SORT_FIELD_UPDATED_AT = 3;
  USER_SORT_FIELD_LAST_LOGIN_AT = 4;
}

// ---- P2 shared entity messages (curated frontend-facing shapes) ----

// User is the frontend-facing user shape. Fields renumbered sequentially vs
// uservl.User (which has region_code at tag 22); the mapping layer translates
// field-by-name, not field-by-number.
message User {
  int64 id = 1;
  string username = 2;
  string nickname = 3;
  string real_name = 4;
  string avatar_url = 5;
  string email = 6;
  string region_code = 7;
  string phone = 8;
  Gender gender = 9 [(buf.validate.field).enum.defined_only = true];
  string birthday = 10; // YYYY-MM-DD
  string timezone = 11;
  string locale = 12;
  string bio = 13;
  UserStatus status = 14 [(buf.validate.field).enum.defined_only = true];
  IdentityProvider register_source = 15;
  UserType user_type = 16 [(buf.validate.field).enum.defined_only = true];
  google.protobuf.Timestamp last_login_at = 17;
  google.protobuf.Timestamp created_at = 18;
  google.protobuf.Timestamp updated_at = 19;
}

message Identity {
  int64 id = 1;
  IdentityProvider provider = 2 [(buf.validate.field).enum.defined_only = true];
  string provider_uid = 3;
  bool verified = 4;
  google.protobuf.Timestamp created_at = 5;
}

message Session {
  string id = 1;
  string ip = 2;
  DeviceType device_type = 3 [(buf.validate.field).enum.defined_only = true];
  string os = 4;
  string browser = 5;
  string country = 6;
  string city = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp last_active_at = 9;
  bool current = 10;
}

message Group {
  int64 id = 1;
  string name = 2;
  string description = 3;
  int64 parent_id = 4;
  string status = 5;
  int32 member_count = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;
}

message Role {
  int64 id = 1;
  string name = 2;
  string description = 3;
  bool is_builtin = 4;
  repeated Permission permissions = 5;
  repeated PermissionGroup perm_groups = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;
}

message Permission {
  int64 id = 1;
  string resource = 2;
  string action = 3;
  string description = 4;
  bool is_builtin = 5;
}

message PermissionGroup {
  int64 id = 1;
  string name = 2;
  string description = 3;
  repeated Permission permissions = 4;
  bool is_builtin = 5;
}

message GroupMember {
  int64 user_id = 1;
  string nickname = 2;
  string avatar_url = 3;
  string role = 4;
  google.protobuf.Timestamp created_at = 5;
}

message LoginLog {
  int64 id = 1;
  int64 user_id = 2;
  IdentityProvider provider = 3;
  LoginAction action = 4;
  bool success = 5;
  string fail_reason = 6;
  string ip = 7;
  DeviceType device_type = 8;
  string os = 9;
  string browser = 10;
  string country = 11;
  string city = 12;
  google.protobuf.Timestamp created_at = 13;
}

message UserRole {
  int64 id = 1;
  int64 role_id = 2;
  string role_name = 3;
  string source = 4; // "direct" | "group:<group_name>"
  google.protobuf.Timestamp created_at = 5;
}
```

> proto 顶部 imports：P1 已有 `google/api/annotations.proto`、`buf/validate/validate.proto`、`google/protobuf/empty.proto`。P2 实体用了 `google.protobuf.Timestamp`，确认顶部有 `import "google/protobuf/timestamp.proto";`（若无则补）。

- [ ] **Step 2: 重生成 + 验证编译**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto
go build ./...
```

Expected: `gen/testkit/v1/` 含新 enum/entity 类型；`go build` PASS（此时 service/handler 还没用它们，但类型已生成可引用）。`api/swagger/testkit/v1/testkit.swagger.json` 同步刷新。

- [ ] **Step 3: Commit**

```bash
git add api/proto/ gen/ api/swagger/
git commit -m "feat(proto): P2 shared enums + curated entity messages"
```

---

## Task 2 (WORKED — Profile「我的资源」模式): GetProfile + UpdateProfile

展示「调用方 user_id 从 ctx 注入、request 不含 user_id」的标准模式。这是 Profile/Identity/Session「我的」类 RPC 的模板。

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`
- Create: `internal/service/user/user.go`
- Create: `internal/service/user/user_test.go`
- Modify: `internal/service/service.go`
- Modify: `pkg/handler/testkit.go`
- Create: `web/src/pages/Profile/index.tsx`

- [ ] **Step 1: 追加 Profile RPC + message 到 proto**

在 Task 1 的实体段之后、`service TestKitService { ... }` 之前插入：

```proto
// ---- Profile (P2) ----
// GetProfile / UpdateProfile / ChangePassword drop the caller's user_id from
// the request (BFF injects it from ctx). ResetPassword is public (code-based).

message GetProfileRequest {} // user_id injected from ctx

message UpdateProfileRequest {
  string username = 1 [(buf.validate.field).string.max_len = 64];
  string nickname = 2 [(buf.validate.field).string.max_len = 64];
  string real_name = 3 [(buf.validate.field).string.max_len = 64];
  string avatar_url = 4 [(buf.validate.field).string.max_len = 512];
  Gender gender = 5 [(buf.validate.field).enum.defined_only = true];
  string birthday = 6 [(buf.validate.field).string.max_len = 10];
  string timezone = 7 [(buf.validate.field).string.max_len = 64];
  string locale = 8 [(buf.validate.field).string.max_len = 16];
  string bio = 9 [(buf.validate.field).string.max_len = 512];
}
```

在 `service TestKitService { ... }` 内（P1 auth RPC 之后）追加：

```proto
  // ---- Profile (P2) ----
  rpc GetProfile(GetProfileRequest) returns (User) {
    option (google.api.http) = { get: "/api/v1/profile" };
  }
  rpc UpdateProfile(UpdateProfileRequest) returns (User) {
    option (google.api.http) = { put: "/api/v1/profile" body: "*" };
  }
```

- [ ] **Step 2: 重生成**

```bash
make proto
```

Expected: `gen/testkit/v1/testkit.pb.go` 含 `GetProfileRequest` / `UpdateProfileRequest` + 服务接口方法。

- [ ] **Step 3: 写 user 域 service 测试（先 FAIL）**

`internal/service/user/user_test.go`：

```go
package user_test

import (
    "context"
    "testing"

    "github.com/servekit/go-common/grpcx"
    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    "github.com/servekit/testkit-service/internal/service/user"
    uservl "github.com/servekit/user-service/gen/user/v1"
    "github.com/stretchr/testify/require"
)

// stubUser embeds uservl.UnimplementedUserServiceServer so only the methods
// under test need overriding. Satisfies uservl.UserServiceServer.
type stubUser struct {
    uservl.UnimplementedUserServiceServer
    gotUserID int64 // captured by GetProfile/UpdateProfile
}

func (s *stubUser) GetProfile(ctx context.Context, req *uservl.GetProfileRequest) (*uservl.User, error) {
    s.gotUserID = req.GetUserId()
    return &uservl.User{Id: req.GetUserId(), Username: "alice", Nickname: "Alice"}, nil
}

func (s *stubUser) UpdateProfile(ctx context.Context, req *uservl.UpdateProfileRequest) (*uservl.User, error) {
    s.gotUserID = req.GetUserId()
    return &uservl.User{Id: req.GetUserId(), Nickname: req.GetNickname()}, nil
}

func ctxWithUser(uid int64) context.Context {
    return context.WithValue(context.Background(), grpcx.UserIDKey, uid)
}

func TestGetProfile_InjectsUserIDFromCtx(t *testing.T) {
    stub := &stubUser{}
    svc := user.New(stub, nil) // jwt unused for profile RPCs

    resp, err := svc.GetProfile(ctxWithUser(42), &testkitv1.GetProfileRequest{})
    require.NoError(t, err)
    require.Equal(t, int64(42), resp.GetId())            // mapped back
    require.Equal(t, int64(42), stub.gotUserID)          // forwarded to downstream
    require.Equal(t, "alice", resp.GetUsername())
}

func TestGetProfile_NoUserIDInCtx_Unauthorized(t *testing.T) {
    svc := user.New(&stubUser{}, nil)
    _, err := svc.GetProfile(context.Background(), &testkitv1.GetProfileRequest{})
    require.Error(t, err)
}

func TestUpdateProfile_ForwardsFieldsAndUserID(t *testing.T) {
    stub := &stubUser{}
    svc := user.New(stub, nil)
    resp, err := svc.UpdateProfile(ctxWithUser(7), &testkitv1.UpdateProfileRequest{
        Nickname: "newnick",
        Gender:   testkitv1.Gender_GENDER_FEMALE,
    })
    require.NoError(t, err)
    require.Equal(t, int64(7), stub.gotUserID)
    require.Equal(t, "newnick", resp.GetNickname())
}
```

- [ ] **Step 4: 运行测试，确认失败**

```bash
go test ./internal/service/user/...
```

Expected: FAIL（`package user` 不存在 / `user.New` 未定义）。

- [ ] **Step 5: 写 user.go（service + converters）**

`internal/service/user/user.go`：

```go
// Package user implements testkit's user domain: forward to user-service with
// testkit-msg ↔ uservl-msg mapping. This is the ONLY package that imports both
// testkitv1 and uservl (v2 §3.4).
package user

import (
    "context"

    "github.com/servekit/go-common/grpcx"
    "github.com/servekit/go-common/xerr/xcodes"
    "github.com/servekit/testkit-service/internal/jwt"
    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    uservl "github.com/servekit/user-service/gen/user/v1"
)

// Service implements testkit's user domain. The user field is typed as the
// full uservl.UserServiceServer — *user.Handler (internal/thirdcall/user)
// satisfies it; test stubs embed uservl.UnimplementedUserServiceServer.
type Service struct {
    user uservl.UserServiceServer
    jwt  *jwt.Manager // non-nil for social-login RPCs (Task 9)
}

// Option configures Service (for test injection).
type Option func(*Service)

// WithUserClient overrides the embedded user client (tests).
func WithUserClient(c uservl.UserServiceServer) Option { return func(s *Service) { s.user = c } }

// New constructs the user-domain service. jwtMgr may be nil when the caller
// does not exercise social-login RPCs.
func New(userClient uservl.UserServiceServer, jwtMgr *jwt.Manager, opts ...Option) *Service {
    s := &Service{user: userClient, jwt: jwtMgr}
    for _, o := range opts {
        o(s)
    }
    return s
}

// GetProfile returns the CALLER's profile. user_id is injected from ctx.
func (s *Service) GetProfile(ctx context.Context, req *testkitv1.GetProfileRequest) (*testkitv1.User, error) {
    userID, err := userIDFromCtx(ctx)
    if err != nil {
        return nil, err
    }
    resp, err := s.user.GetProfile(ctx, &uservl.GetProfileRequest{UserId: userID})
    if err != nil {
        return nil, err
    }
    return toTestkitUser(resp), nil
}

// UpdateProfile updates the CALLER's profile. user_id is injected from ctx.
func (s *Service) UpdateProfile(ctx context.Context, req *testkitv1.UpdateProfileRequest) (*testkitv1.User, error) {
    userID, err := userIDFromCtx(ctx)
    if err != nil {
        return nil, err
    }
    resp, err := s.user.UpdateProfile(ctx, toUserUpdateProfileRequest(req, userID))
    if err != nil {
        return nil, err
    }
    return toTestkitUser(resp), nil
}

// userIDFromCtx reads the caller's user_id (AuthInterceptor, P1 Task 11) and
// maps the missing-ctx case to a 401.
func userIDFromCtx(ctx context.Context) (int64, error) {
    uid, err := grpcx.GetUserIDFromCtx(ctx)
    if err != nil {
        return 0, xcodes.ErrUnauthorized.Wrap(err)
    }
    return uid, nil
}

// --- converters (testkit DTO ↔ user-service proto) ---

func toUserUpdateProfileRequest(r *testkitv1.UpdateProfileRequest, userID int64) *uservl.UpdateProfileRequest {
    return &uservl.UpdateProfileRequest{
        UserId:    userID,
        Username:  r.GetUsername(),
        Nickname:  r.GetNickname(),
        RealName:  r.GetRealName(),
        AvatarUrl: r.GetAvatarUrl(),
        Gender:    uservl.Gender(r.GetGender()),
        Birthday:  r.GetBirthday(),
        Timezone:  r.GetTimezone(),
        Locale:    r.GetLocale(),
        Bio:       r.GetBio(),
    }
}

func toTestkitUser(u *uservl.User) *testkitv1.User {
    if u == nil {
        return nil
    }
    return &testkitv1.User{
        Id:             u.GetId(),
        Username:       u.GetUsername(),
        Nickname:       u.GetNickname(),
        RealName:       u.GetRealName(),
        AvatarUrl:      u.GetAvatarUrl(),
        Email:          u.GetEmail(),
        RegionCode:     u.GetRegionCode(),
        Phone:          u.GetPhone(),
        Gender:         testkitv1.Gender(u.GetGender()),
        Birthday:       u.GetBirthday(),
        Timezone:       u.GetTimezone(),
        Locale:         u.GetLocale(),
        Bio:            u.GetBio(),
        Status:         testkitv1.UserStatus(u.GetStatus()),
        RegisterSource: testkitv1.IdentityProvider(u.GetRegisterSource()),
        UserType:       testkitv1.UserType(u.GetUserType()),
        LastLoginAt:    u.GetLastLoginAt(),
        CreatedAt:      u.GetCreatedAt(),
        UpdatedAt:      u.GetUpdatedAt(),
    }
}
```

> 枚举全部整型直转（镜像 enum 同名同号）。本域 `toTestkitUser`（`internal/service/user`）是 user 域各 RPC 共用的 converter，后续 task 直接复用。
>
> 注：`user_type` 已由 **P1** 的 auth 域 `toTestkitUser` 映射（P1 的 `User` message 含 `user_type`），故 `Login`/`Register` 返回的 `User` 已带 `user_type`，前端登录后即可按内部/普通分流（见 P1 Task 17 access.ts）。本 Task 把共享 `User` message 扩到 19 字段（加 status/gender/...）时，**这些额外字段不影响登录分流**（只需 `user_type`）；若希望登录响应也带回这些字段，再把它们补进 auth 域的 `toTestkitUser` 即可（可选）。

- [ ] **Step 6: 运行测试，确认通过**

```bash
go test ./internal/service/user/...
```

Expected: PASS（3 个 case 全绿）。

- [ ] **Step 7: service.go 持有 user 子服务 + facade**

在 `internal/service/service.go` 的 `Service` struct 加字段（避免与 P1 的 `user *user.Handler` 重名，用 `userSvc`）：

```go
import (
    // ... existing ...
    "github.com/servekit/testkit-service/internal/service/user"
)

// in Service struct (alongside P1 fields):
userSvc *user.Service

// in New(), after the user handler (s.user, the *user.Handler) + jwtMgr are built:
s.userSvc = user.New(s.user, jwtMgr)

// facade accessor:
// User returns the user-domain sub-service (profile/identity/session/...).
func (s *Service) User() *user.Service { return s.userSvc }
```

> `jwtMgr` 在 P1 Task 14 已于 `service.New` 内构造（`jwt.NewManager(cfg.JWT.Secret, cfg.JWT.TTL)`）。若 P1 把 jwtMgr 留在 server.go 而未传入 service.New，则在此 step 把它传入（`user.New` 需要；`auth.New` 也需要）。

- [ ] **Step 8: handler 加委托**

在 `pkg/handler/testkit.go` 追加：

```go
func (h *Handler) GetProfile(ctx context.Context, req *testkitv1.GetProfileRequest) (*testkitv1.User, error) {
    return h.svc.User().GetProfile(ctx, req)
}

func (h *Handler) UpdateProfile(ctx context.Context, req *testkitv1.UpdateProfileRequest) (*testkitv1.User, error) {
    return h.svc.User().UpdateProfile(ctx, req)
}
```

- [ ] **Step 9: 验证构建 + 测试**

```bash
go build ./...
go test ./...
```

Expected: PASS。

- [ ] **Step 10: 前端 — 个人资料页**

先重生前端 services（proto 改过）：

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm run openapi
```

Expected: `src/services/testkit/` 含 `getProfile` / `updateProfile` 请求函数 + `API` 类型（User 等）。

`web/src/pages/Profile/index.tsx`（ProForm 展示 + 编辑，调用生成 service，无手写 fetch）：

```tsx
import { PageContainer, ProForm, ProFormText, ProFormSelect } from '@ant-design/pro-components';
import { message, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { getProfile, updateProfile } from '@/services/testkit';

export default function ProfilePage() {
  const [initial, setInitial] = useState<API.User>();

  useEffect(() => {
    getProfile().then((u) => setInitial(u));
  }, []);

  return (
    <PageContainer>
      {/* 用户类型区分（只读，本期只展示不做权限分支）——见决策 4「UserType」 */}
      <div style={{ marginBottom: 16 }}>
        账号类型：
        {initial?.userType === 'USER_TYPE_INTERNAL' ? (
          <Tag color="gold">内部</Tag>
        ) : (
          <Tag color="blue">外部</Tag>
        )}
      </div>
      <ProForm<API.UpdateProfileRequest>
        initialValues={initial}
        onFinish={async (vals) => {
          const u = await updateProfile(vals);
          setInitial(u);
          message.success('已保存');
          return true;
        }}
      >
        <ProFormText name="username" label="用户名" />
        <ProFormText name="nickname" label="昵称" />
        <ProFormText name="real_name" label="真实姓名" />
        <ProFormText name="avatar_url" label="头像 URL" />
        <ProFormSelect
          name="gender"
          label="性别"
          valueEnum={{
            GENDER_UNSPECIFIED: '未设置',
            GENDER_MALE: '男',
            GENDER_FEMALE: '女',
            GENDER_OTHER: '其他',
            GENDER_UNKNOWN: '保密',
          }}
        />
        <ProFormText name="timezone" label="时区" />
        <ProFormText name="locale" label="语言" />
        <ProFormText name="bio" label="简介" />
      </ProForm>
    </PageContainer>
  );
}
```

> 生成的函数名以 `npm run openapi` 实际产物为准（operationId 经 `simple_operation_ids=true` = RPC 名，oneapi 引擎通常小写首字母 → `getProfile`/`updateProfile`；若产物是 `getProfile1` 等带尾缀，按实际调整 import）。

- [ ] **Step 11: Commit**

```bash
cd /Users/moss/code/servekit/testkit-service
git add -A
git commit -m "feat(user): profile domain (GetProfile/UpdateProfile) + mapping + frontend"
```

---

## Task 3 (WORKED — Admin 目标 ID 模式): GetUser + DisableUser

展示「request 保留目标资源 ID（target user_id）、不做 ctx 注入」的 admin 模式。这是 Admin-Users / RBAC 所有 RPC 的模板。

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`、`internal/service/user/user.go`、`internal/service/user/user_test.go`、`pkg/handler/testkit.go`
- Create: `web/src/pages/User/List.tsx`

- [ ] **Step 1: 追加 admin-user proto（GetUser + DisableUser）**

实体段后追加：

```proto
// ---- Admin-Users (P2) ----
message GetUserRequest {
  int64 user_id = 1 [(buf.validate.field).int64.gt = 0]; // target user (kept)
}

message DisableUserRequest {
  int64 user_id = 1 [(buf.validate.field).int64.gt = 0]; // target user (kept)
  bool disable = 2;
  string reason = 3 [(buf.validate.field).string.max_len = 512];
}
```

service 段追加：

```proto
  // ---- Admin-Users (P2) ----
  rpc GetUser(GetUserRequest) returns (User) {
    option (google.api.http) = { get: "/api/v1/users/{user_id}" };
  }
  rpc DisableUser(DisableUserRequest) returns (User) {
    option (google.api.http) = { post: "/api/v1/users/{user_id}/disable" body: "*" };
  }
```

> `{user_id}` 从 path 绑定到 `DisableUserRequest.user_id`；`disable` / `reason` 从 body。

- [ ] **Step 2: 重生成**

```bash
make proto
```

- [ ] **Step 3: 写测试（先 FAIL）**

追加到 `internal/service/user/user_test.go`：

```go
func (s *stubUser) GetUser(ctx context.Context, req *uservl.GetUserRequest) (*uservl.User, error) {
    if req.GetUserId() == 999 { // simulate not-found
        return nil, nil
    }
    return &uservl.User{Id: req.GetUserId(), Username: "u", Status: uservl.UserStatus_USER_STATUS_ACTIVE}, nil
}

func (s *stubUser) DisableUser(ctx context.Context, req *uservl.DisableUserRequest) (*uservl.User, error) {
    st := uservl.UserStatus_USER_STATUS_DISABLED
    if !req.GetDisable() {
        st = uservl.UserStatus_USER_STATUS_ACTIVE
    }
    return &uservl.User{Id: req.GetUserId(), Status: st}, nil
}

func TestGetUser_ForwardsTargetUserID(t *testing.T) {
    svc := user.New(&stubUser{}, nil)
    resp, err := svc.GetUser(context.Background(), &testkitv1.GetUserRequest{UserId: 5})
    require.NoError(t, err)
    require.Equal(t, int64(5), resp.GetId())
    require.Equal(t, testkitv1.UserStatus_USER_STATUS_ACTIVE, resp.GetStatus())
}

func TestDisableUser_PreservesTargetIDAndDisable(t *testing.T) {
    svc := user.New(&stubUser{}, nil)
    resp, err := svc.DisableUser(context.Background(), &testkitv1.DisableUserRequest{
        UserId: 5, Disable: true, Reason: "spam",
    })
    require.NoError(t, err)
    require.Equal(t, int64(5), resp.GetId())
    require.Equal(t, testkitv1.UserStatus_USER_STATUS_DISABLED, resp.GetStatus())
}
```

> `uservl.UserStatus_USER_STATUS_ACTIVE` / `_DISABLED`：user-service 枚举值名（与 testkit 镜像一致）。stub 覆写 GetUser/DisableUser。

- [ ] **Step 4: 运行，确认失败**

```bash
go test ./internal/service/user/...
```

Expected: FAIL（`svc.GetUser` / `svc.DisableUser` 未定义）。

- [ ] **Step 5: 实现（追加到 user.go，converter 区块）**

在 `user.go` 的 `Service` 方法区追加：

```go
// GetUser returns a user by target ID (admin view). No ctx injection — user_id
// in the request is the resource being acted on, not the caller.
func (s *Service) GetUser(ctx context.Context, req *testkitv1.GetUserRequest) (*testkitv1.User, error) {
    resp, err := s.user.GetUser(ctx, toUserGetUserRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitUser(resp), nil
}

// DisableUser toggles a target user between ACTIVE/DISABLED.
func (s *Service) DisableUser(ctx context.Context, req *testkitv1.DisableUserRequest) (*testkitv1.User, error) {
    resp, err := s.user.DisableUser(ctx, toUserDisableUserRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitUser(resp), nil
}
```

在 `// --- converters ---` 区追加：

```go
func toUserGetUserRequest(r *testkitv1.GetUserRequest) *uservl.GetUserRequest {
    return &uservl.GetUserRequest{UserId: r.GetUserId()}
}

func toUserDisableUserRequest(r *testkitv1.DisableUserRequest) *uservl.DisableUserRequest {
    return &uservl.DisableUserRequest{
        UserId:  r.GetUserId(),
        Disable: r.GetDisable(),
        Reason:  r.GetReason(),
    }
}
```

- [ ] **Step 6: 运行，确认通过**

```bash
go test ./internal/service/user/...
```

Expected: PASS。

- [ ] **Step 7: handler 委托**

追加到 `pkg/handler/testkit.go`：

```go
func (h *Handler) GetUser(ctx context.Context, req *testkitv1.GetUserRequest) (*testkitv1.User, error) {
    return h.svc.User().GetUser(ctx, req)
}

func (h *Handler) DisableUser(ctx context.Context, req *testkitv1.DisableUserRequest) (*testkitv1.User, error) {
    return h.svc.User().DisableUser(ctx, req)
}
```

- [ ] **Step 8: 前端 — 用户列表 + 禁用操作**

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm run openapi
```

`web/src/pages/User/List.tsx`（ProTable；Task 4 会复用此页接 `listUsersPaged`，此处先用本地占位数据 + disable action，Task 4 Step 4 替换 request）：

```tsx
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { Button, Popconfirm, message, Tag } from 'antd';
import { disableUser } from '@/services/testkit';
import { useRef } from 'react';
import type { ActionType } from '@ant-design/pro-components';

const statusTag: Record<string, { color: string; text: string }> = {
  USER_STATUS_ACTIVE: { color: 'green', text: '正常' },
  USER_STATUS_DISABLED: { color: 'red', text: '禁用' },
  USER_STATUS_PENDING_REVIEW: { color: 'orange', text: '待激活' },
};

export default function UserListPage() {
  const actionRef = useRef<ActionType>();
  const columns: ProColumns<API.User>[] = [
    { title: 'ID', dataIndex: 'id', width: 120 },
    { title: '用户名', dataIndex: 'username' },
    { title: '昵称', dataIndex: 'nickname' },
    { title: '邮箱', dataIndex: 'email' },
    {
      // 用户类型区分（本期只展示，不做权限分支）——见决策 4「UserType」
      title: '类型', dataIndex: 'userType',
      render: (_, r) => (
        <Tag color={r.userType === 'USER_TYPE_INTERNAL' ? 'gold' : 'blue'}>
          {r.userType === 'USER_TYPE_INTERNAL' ? '内部' : '外部'}
        </Tag>
      ),
    },
    {
      title: '状态', dataIndex: 'status',
      render: (_, r) => {
        const s = statusTag[r.status]; return s ? <Tag color={s.color}>{s.text}</Tag> : '-';
      },
    },
    {
      title: '操作', valueType: 'option',
      render: (_, r) => [
        <Popconfirm
          key="toggle"
          title={r.status === 'USER_STATUS_DISABLED' ? '启用该用户？' : '禁用该用户？'}
          onConfirm={async () => {
            await disableUser({ user_id: r.id, disable: r.status !== 'USER_STATUS_DISABLED' });
            message.success('已操作');
            actionRef.current?.reload();
          }}
        >
          <Button type="link" danger={r.status !== 'USER_STATUS_DISABLED'}>
            {r.status === 'USER_STATUS_DISABLED' ? '启用' : '禁用'}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.User>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        // request wired in Task 4 (ListUsersPaged); placeholder search here.
        search={{ labelWidth: 'auto' }}
      />
    </PageContainer>
  );
}
```

- [ ] **Step 9: Commit**

```bash
cd /Users/moss/code/servekit/testkit-service
git add -A
git commit -m "feat(user): admin GetUser/DisableUser (target-id pattern) + user list page"
```

---

## Task 4 (WORKED — 分页列表模式): ListUsersPaged

展示「offset 分页 + 排序 + 多过滤」的列表映射模式。ListUsers（游标分页）和其它 cursor 列表（Task 7/8/11/12/13）同构。

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`、`internal/service/user/user.go`、`internal/service/user/user_test.go`、`pkg/handler/testkit.go`
- Modify: `web/src/pages/User/List.tsx`

- [ ] **Step 1: 追加 ListUsersPaged proto**

实体段后追加：

```proto
message ListUsersPagedRequest {
  UserStatus status = 1;
  string nickname = 2 [(buf.validate.field).string.max_len = 64];
  Gender gender = 3;
  IdentityProvider register_source = 4;
  DeviceType register_device = 5;
  UserType user_type = 6;
  string locale = 7 [(buf.validate.field).string.max_len = 16];
  string timezone = 8 [(buf.validate.field).string.max_len = 64];
  string register_ip = 9 [(buf.validate.field).string.max_len = 45];
  string last_login_ip = 10 [(buf.validate.field).string.max_len = 45];
  google.protobuf.Timestamp created_at_start = 11;
  google.protobuf.Timestamp created_at_end = 12;
  google.protobuf.Timestamp last_login_at_start = 13;
  google.protobuf.Timestamp last_login_at_end = 14;
  repeated int64 user_ids = 15;
  string email = 16 [(buf.validate.field).string.max_len = 256];
  string region_code = 17 [(buf.validate.field).string.pattern = "^[A-Z]{2}$"];
  string phone = 18 [(buf.validate.field).string.max_len = 20];
  string username = 19 [(buf.validate.field).string.max_len = 64];
  UserSortField order_by = 20 [(buf.validate.field).enum.defined_only = true];
  bool descending = 21;
  int32 page = 22 [(buf.validate.field).int32.gte = 1];
  int32 page_size = 23 [(buf.validate.field).int32 = {gte: 1, lte: 100}];
  bool count = 24;
}

message ListUsersPagedResponse {
  repeated User users = 1;
  int64 total = 2;
  int32 total_pages = 3;
}
```

service 段追加：

```proto
  rpc ListUsersPaged(ListUsersPagedRequest) returns (ListUsersPagedResponse) {
    option (google.api.http) = { get: "/api/v1/users/paged" };
  }
```

> GET 列表：grpc-gateway 把 query 参数绑定到 message 同名字段（含 `created_at_start` 等），enum 以名字符串表示。

- [ ] **Step 2: 重生成**

```bash
make proto
```

- [ ] **Step 3: 写测试（先 FAIL）**

追加到 `user_test.go`：

```go
func (s *stubUser) ListUsersPaged(ctx context.Context, req *uservl.ListUsersPagedRequest) (*uservl.ListUsersPagedResponse, error) {
    return &uservl.ListUsersPagedResponse{
        Users:      []*uservl.User{{Id: 1}, {Id: 2}},
        Total:      2,
        TotalPages: 1,
    }, nil
}

func TestListUsersPaged_MapsFiltersAndPagination(t *testing.T) {
    svc := user.New(&stubUser{}, nil)
    resp, err := svc.ListUsersPaged(context.Background(), &testkitv1.ListUsersPagedRequest{
        Status:    testkitv1.UserStatus_USER_STATUS_ACTIVE,
        OrderBy:   testkitv1.UserSortField_USER_SORT_FIELD_CREATED_AT,
        Page:      1,
        PageSize:  20,
        Count:     true,
        UserIds:   []int64{1, 2},
    })
    require.NoError(t, err)
    require.Len(t, resp.GetUsers(), 2)
    require.Equal(t, int64(2), resp.GetTotal())
}

func TestListUsersPaged_MappingCoversAllFields(t *testing.T) {
    // Round-trip a fully-populated request through the converter and spot-check
    // every field is forwarded (guards against drift as uservl evolves).
    got := user.ToUserListUsersPagedRequest(&testkitv1.ListUsersPagedRequest{
        Status: testkitv1.UserStatus_USER_STATUS_DISABLED, Nickname: "n",
        Gender: testkitv1.Gender_GENDER_MALE, RegisterSource: testkitv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB,
        RegisterDevice: testkitv1.DeviceType_DEVICE_TYPE_WEB, UserType: testkitv1.UserType_USER_TYPE_INTERNAL,
        Locale: "zh", Timezone: "UTC", RegisterIp: "1.1.1.1", LastLoginIp: "2.2.2.2",
        Email: "a@b.c", RegionCode: "CN", Phone: "13800000000", Username: "u",
        OrderBy: testkitv1.UserSortField_USER_SORT_FIELD_ID, Descending: true,
        Page: 2, PageSize: 50, Count: false, UserIds: []int64{9},
    })
    require.Equal(t, uservl.UserStatus_USER_STATUS_DISABLED, got.GetStatus())
    require.Equal(t, "n", got.GetNickname())
    require.Equal(t, uservl.Gender_GENDER_MALE, got.GetGender())
    require.Equal(t, uservl.IdentityProvider_IDENTITY_PROVIDER_GITHUB, got.GetRegisterSource())
    require.Equal(t, uservl.DeviceType_DEVICE_TYPE_WEB, got.GetRegisterDevice())
    require.Equal(t, uservl.UserType_USER_TYPE_INTERNAL, got.GetUserType())
    require.Equal(t, "CN", got.GetRegionCode())
    require.Equal(t, uservl.UserSortField_USER_SORT_FIELD_ID, got.GetOrderBy())
    require.Equal(t, int32(2), got.GetPage())
    require.Equal(t, []int64{9}, got.GetUserIds())
}
```

> 第二个 case 用了一个**导出**的 `user.ToUserListUsersPagedRequest`——为了让单测能直接验证 converter（覆盖全部字段，防止字段漂移）。因此 Step 5 该 converter 须导出（仅此一个例外，其它 converter 保持 unexported）。

- [ ] **Step 4: 运行，确认失败**

```bash
go test ./internal/service/user/...
```

Expected: FAIL。

- [ ] **Step 5: 实现（追加到 user.go）**

```go
// ListUsersPaged returns offset-paginated users (admin UI).
func (s *Service) ListUsersPaged(ctx context.Context, req *testkitv1.ListUsersPagedRequest) (*testkitv1.ListUsersPagedResponse, error) {
    resp, err := s.user.ListUsersPaged(ctx, ToUserListUsersPagedRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitListUsersPagedResponse(resp), nil
}
```

converter 区追加（字段 1:1，enum 整型直转；`ToUserListUsersPagedRequest` 导出以供单测）：

```go
// ToUserListUsersPagedRequest maps the testkit paged list request to uservl.
// Exported for table-driven mapping tests.
func ToUserListUsersPagedRequest(r *testkitv1.ListUsersPagedRequest) *uservl.ListUsersPagedRequest {
    return &uservl.ListUsersPagedRequest{
        Status:            uservl.UserStatus(r.GetStatus()),
        Nickname:          r.GetNickname(),
        Gender:            uservl.Gender(r.GetGender()),
        RegisterSource:    uservl.IdentityProvider(r.GetRegisterSource()),
        RegisterDevice:    uservl.DeviceType(r.GetRegisterDevice()),
        UserType:          uservl.UserType(r.GetUserType()),
        Locale:            r.GetLocale(),
        Timezone:          r.GetTimezone(),
        RegisterIp:        r.GetRegisterIp(),
        LastLoginIp:       r.GetLastLoginIp(),
        CreatedAtStart:    r.GetCreatedAtStart(),
        CreatedAtEnd:      r.GetCreatedAtEnd(),
        LastLoginAtStart:  r.GetLastLoginAtStart(),
        LastLoginAtEnd:    r.GetLastLoginAtEnd(),
        UserIds:           r.GetUserIds(),
        Email:             r.GetEmail(),
        RegionCode:        r.GetRegionCode(),
        Phone:             r.GetPhone(),
        Username:          r.GetUsername(),
        OrderBy:           uservl.UserSortField(r.GetOrderBy()),
        Descending:        r.GetDescending(),
        Page:              r.GetPage(),
        PageSize:          r.GetPageSize(),
        Count:             r.GetCount(),
    }
}

func toTestkitListUsersPagedResponse(r *uservl.ListUsersPagedResponse) *testkitv1.ListUsersPagedResponse {
    if r == nil {
        return nil
    }
    users := make([]*testkitv1.User, 0, len(r.GetUsers()))
    for _, u := range r.GetUsers() {
        users = append(users, toTestkitUser(u))
    }
    return &testkitv1.ListUsersPagedResponse{
        Users:      users,
        Total:      r.GetTotal(),
        TotalPages: r.GetTotalPages(),
    }
}
```

- [ ] **Step 6: 运行，确认通过**

```bash
go test ./internal/service/user/...
```

Expected: PASS。

- [ ] **Step 7: handler 委托**

```go
func (h *Handler) ListUsersPaged(ctx context.Context, req *testkitv1.ListUsersPagedRequest) (*testkitv1.ListUsersPagedResponse, error) {
    return h.svc.User().ListUsersPaged(ctx, req)
}
```

- [ ] **Step 8: 前端 — 接通 ProTable request**

`npm run openapi`（重生）。把 Task 3 的 `web/src/pages/User/List.tsx` 的 `<ProTable>` 加上 `request` 与 `params`：

```tsx
import { listUsersPaged, disableUser } from '@/services/testkit';
// ...
        request={async (params) => {
          const { current = 1, pageSize = 20, status, nickname, username, email, ...rest } = params;
          const resp = await listUsersPaged({
            page: current,
            page_size: pageSize,
            count: true,
            status: status as API.UserStatus,
            nickname, username, email,
          });
          return {
            data: resp.users ?? [],
            total: resp.total ?? 0,
            success: true,
          };
        }}
        options={{ pageSize: 20 }}
```

并把 `<ProTable>` 的列加 `search` 字段（`username` / `nickname` / `email` / `status` 已是 ProTable 搜索项，dataIndex 与 query 名一致即可被 `params` 收集）。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(user): ListUsersPaged (paginated list pattern) + wire ProTable request"
```

---

## Task 5 (WORKED — RBAC create+list 模式): CreateRole + ListRoles

展示「create（带 repeated 子 ID）+ cursor list」的 RBAC 模式。RBAC 全域（Group/Permission/...）同构。

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`、`internal/service/user/user.go`、`internal/service/user/user_test.go`、`pkg/handler/testkit.go`
- Create: `web/src/pages/Rbac/Roles.tsx`

- [ ] **Step 1: 追加 RBAC-Role proto（CreateRole + ListRole）**

实体段后追加：

```proto
// ---- RBAC-Role (P2) ----
message CreateRoleRequest {
  string name = 1 [(buf.validate.field).string = {min_len: 1, max_len: 64}];
  string description = 2 [(buf.validate.field).string.max_len = 512];
  repeated int64 permission_ids = 3;
  repeated int64 permission_group_ids = 4;
}

message ListRolesRequest {
  int32 page_size = 1 [(buf.validate.field).int32 = {gte: 1, lte: 100}];
  string cursor = 2 [(buf.validate.field).string.max_len = 64];
}

message ListRolesResponse {
  repeated Role roles = 1;
  string next_cursor = 2;
  int32 total = 3;
}
```

service 段追加：

```proto
  // ---- RBAC-Role (P2) ----
  rpc CreateRole(CreateRoleRequest) returns (Role) {
    option (google.api.http) = { post: "/api/v1/rbac/roles" body: "*" };
  }
  rpc ListRoles(ListRolesRequest) returns (ListRolesResponse) {
    option (google.api.http) = { get: "/api/v1/rbac/roles" };
  }
```

- [ ] **Step 2: 重生成**

```bash
make proto
```

- [ ] **Step 3: 写测试（先 FAIL）**

追加到 `user_test.go`：

```go
func (s *stubUser) CreateRole(ctx context.Context, req *uservl.CreateRoleRequest) (*uservl.Role, error) {
    return &uservl.Role{
        Id: 1, Name: req.GetName(), Description: req.GetDescription(),
        Permissions:    []*uservl.Permission{{Id: req.GetPermissionIds()[0]}},
        PermGroups:     []*uservl.PermissionGroup{{Id: req.GetPermissionGroupIds()[0]}},
    }, nil
}

func (s *stubUser) ListRoles(ctx context.Context, req *uservl.ListRolesRequest) (*uservl.ListRolesResponse, error) {
    return &uservl.ListRolesResponse{
        Roles:      []*uservl.Role{{Id: 1, Name: "admin", IsBuiltin: false}},
        NextCursor: "cur-1",
        Total:      1,
    }, nil
}

func TestCreateRole_ForwardsPermissionIDs(t *testing.T) {
    svc := user.New(&stubUser{}, nil)
    resp, err := svc.CreateRole(context.Background(), &testkitv1.CreateRoleRequest{
        Name: "editor", Description: "d",
        PermissionIds:     []int64{10, 11},
        PermissionGroupIds: []int64{20},
    })
    require.NoError(t, err)
    require.Equal(t, "editor", resp.GetName())
    require.Len(t, resp.GetPermissions(), 1)
    require.Equal(t, int64(10), resp.GetPermissions()[0].GetId())
    require.Equal(t, int64(20), resp.GetPermGroups()[0].GetId())
}

func TestListRoles_MapsCursorResponse(t *testing.T) {
    svc := user.New(&stubUser{}, nil)
    resp, err := svc.ListRoles(context.Background(), &testkitv1.ListRolesRequest{PageSize: 10})
    require.NoError(t, err)
    require.Len(t, resp.GetRoles(), 1)
    require.Equal(t, "cur-1", resp.GetNextCursor())
    require.False(t, resp.GetRoles()[0].GetIsBuiltin())
}
```

- [ ] **Step 4: 运行，确认失败**

```bash
go test ./internal/service/user/...
```

Expected: FAIL。

- [ ] **Step 5: 实现（追加到 user.go）**

```go
// CreateRole creates a role with permissions and/or permission groups.
func (s *Service) CreateRole(ctx context.Context, req *testkitv1.CreateRoleRequest) (*testkitv1.Role, error) {
    resp, err := s.user.CreateRole(ctx, toUserCreateRoleRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitRole(resp), nil
}

// ListRoles returns cursor-paginated roles.
func (s *Service) ListRoles(ctx context.Context, req *testkitv1.ListRolesRequest) (*testkitv1.ListRolesResponse, error) {
    resp, err := s.user.ListRoles(ctx, toUserListRolesRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitListRolesResponse(resp), nil
}
```

converter 区追加：

```go
func toUserCreateRoleRequest(r *testkitv1.CreateRoleRequest) *uservl.CreateRoleRequest {
    return &uservl.CreateRoleRequest{
        Name:              r.GetName(),
        Description:       r.GetDescription(),
        PermissionIds:     r.GetPermissionIds(),
        PermissionGroupIds: r.GetPermissionGroupIds(),
    }
}

func toUserListRolesRequest(r *testkitv1.ListRolesRequest) *uservl.ListRolesRequest {
    return &uservl.ListRolesRequest{
        PageSize: r.GetPageSize(),
        Cursor:   r.GetCursor(),
    }
}

func toTestkitRole(r *uservl.Role) *testkitv1.Role {
    if r == nil {
        return nil
    }
    perms := make([]*testkitv1.Permission, 0, len(r.GetPermissions()))
    for _, p := range r.GetPermissions() {
        perms = append(perms, toTestkitPermission(p))
    }
    groups := make([]*testkitv1.PermissionGroup, 0, len(r.GetPermGroups()))
    for _, g := range r.GetPermGroups() {
        groups = append(groups, toTestkitPermissionGroup(g))
    }
    return &testkitv1.Role{
        Id:          r.GetId(),
        Name:        r.GetName(),
        Description: r.GetDescription(),
        IsBuiltin:   r.GetIsBuiltin(),
        Permissions: perms,
        PermGroups:  groups,
        CreatedAt:   r.GetCreatedAt(),
        UpdatedAt:   r.GetUpdatedAt(),
    }
}

func toTestkitListRolesResponse(r *uservl.ListRolesResponse) *testkitv1.ListRolesResponse {
    if r == nil {
        return nil
    }
    roles := make([]*testkitv1.Role, 0, len(r.GetRoles()))
    for _, rl := range r.GetRoles() {
        roles = append(roles, toTestkitRole(rl))
    }
    return &testkitv1.ListRolesResponse{Roles: roles, NextCursor: r.GetNextCursor(), Total: r.GetTotal()}
}
```

> `toTestkitPermission` / `toTestkitPermissionGroup` 在 Task 13（Permission 子域）首次需要时定义；但 Role 引用了它们，因此**在 Task 5 Step 5 同步把这两个 converter 一起加上**（即使 Permission 子域 RPC 还没加），避免编译断裂：

```go
func toTestkitPermission(p *uservl.Permission) *testkitv1.Permission {
    if p == nil {
        return nil
    }
    return &testkitv1.Permission{
        Id: p.GetId(), Resource: p.GetResource(), Action: p.GetAction(),
        Description: p.GetDescription(), IsBuiltin: p.GetIsBuiltin(),
    }
}

func toTestkitPermissionGroup(g *uservl.PermissionGroup) *testkitv1.PermissionGroup {
    if g == nil {
        return nil
    }
    perms := make([]*testkitv1.Permission, 0, len(g.GetPermissions()))
    for _, p := range g.GetPermissions() {
        perms = append(perms, toTestkitPermission(p))
    }
    return &testkitv1.PermissionGroup{
        Id: g.GetId(), Name: g.GetName(), Description: g.GetDescription(),
        Permissions: perms, IsBuiltin: g.GetIsBuiltin(),
    }
}
```

- [ ] **Step 6: 运行，确认通过**

```bash
go test ./internal/service/user/...
```

Expected: PASS。

- [ ] **Step 7: handler 委托**

```go
func (h *Handler) CreateRole(ctx context.Context, req *testkitv1.CreateRoleRequest) (*testkitv1.Role, error) {
    return h.svc.User().CreateRole(ctx, req)
}
func (h *Handler) ListRoles(ctx context.Context, req *testkitv1.ListRolesRequest) (*testkitv1.ListRolesResponse, error) {
    return h.svc.User().ListRoles(ctx, req)
}
```

- [ ] **Step 8: 前端 — 角色列表 + 新建**

`npm run openapi`。`web/src/pages/Rbac/Roles.tsx`：

```tsx
import { PageContainer, ProTable, ModalForm, ProFormText, type ProColumns } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listRoles, createRole } from '@/services/testkit';
import { useRef, useState } from 'react';
import type { ActionType } from '@ant-design/pro-components';

export default function RolesPage() {
  const actionRef = useRef<ActionType>();
  const [createOpen, setCreateOpen] = useState(false);

  const columns: ProColumns<API.Role>[] = [
    { title: 'ID', dataIndex: 'id', width: 100 },
    { title: '名称', dataIndex: 'name' },
    { title: '描述', dataIndex: 'description' },
    {
      title: '内置', dataIndex: 'is_builtin',
      render: (_, r) => r.is_builtin ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>,
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.Role>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        request={async (params) => {
          const resp = await listRoles({ page_size: params.pageSize ?? 20, cursor: '' });
          return { data: resp.roles ?? [], total: resp.total ?? 0, success: true };
        }}
        toolBarRender={() => [
          <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建角色
          </Button>,
        ]}
      />
      <ModalForm title="新建角色" open={createOpen} onOpenChange={setCreateOpen}
        onFinish={async (vals) => {
          await createRole(vals);
          actionRef.current?.reload();
          return true;
        }}>
        <ProFormText name="name" label="名称" rules={[{ required: true }]} />
        <ProFormText name="description" label="描述" />
      </ModalForm>
    </PageContainer>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(user): RBAC CreateRole/ListRoles (create+cursor-list pattern) + roles page"
```

---

## Task 6 (Enumeration — Profile 余下): ChangePassword + ResetPassword

按 Task 2 的「ctx 注入 / 公开」模式实现。`make proto` 后追加到 proto、`user.go`、handler。

- [ ] **Step 1: 追加 proto**

```proto
message ChangePasswordRequest {
  string old_password = 1 [(buf.validate.field).string = {min_len: 1, max_len: 128}];
  string new_password = 2 [(buf.validate.field).string = {min_len: 8, max_len: 128}];
}

message ResetPasswordRequest {
  string email = 1 [(buf.validate.field).string.max_len = 256];
  string code = 2 [(buf.validate.field).string = {min_len: 1, max_len: 16}];
  string new_password = 3 [(buf.validate.field).string = {min_len: 8, max_len: 128}];
  string region_code = 4 [(buf.validate.field).string.pattern = "^[A-Z]{2}$"];
  string phone = 5 [(buf.validate.field).string.max_len = 20];

  option (buf.validate.message).cel = {
    id: "target_exclusive"
    message: "exactly one of email or region_code+phone must be set"
    expression: "(this.email != '' && this.region_code == '' && this.phone == '') || (this.email == '' && this.region_code != '' && this.phone != '')"
  };
}
```

service 段：

```proto
  rpc ChangePassword(ChangePasswordRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { post: "/api/v1/profile/password" body: "*" };
  }
  rpc ResetPassword(ResetPasswordRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { post: "/api/v1/auth/password-reset" body: "*" };
  }
```

- [ ] **Step 2: service.go 方法（user.go）+ converter + 下游 target**

```go
// ChangePassword verifies old and sets new; user_id from ctx.
// Downstream: uservl.ChangePasswordRequest{user_id, old_password, new_password}.
func (s *Service) ChangePassword(ctx context.Context, req *testkitv1.ChangePasswordRequest) (*emptypb.Empty, error) {
    userID, err := userIDFromCtx(ctx)
    if err != nil { return nil, err }
    return s.user.ChangePassword(ctx, &uservl.ChangePasswordRequest{
        UserId:      userID,
        OldPassword: req.GetOldPassword(),
        NewPassword: req.GetNewPassword(),
    })
}

// ResetPassword is public (code-based). No ctx injection.
// Downstream: uservl.ResetPasswordRequest{email, code, new_password, region_code, phone}.
func (s *Service) ResetPassword(ctx context.Context, req *testkitv1.ResetPasswordRequest) (*emptypb.Empty, error) {
    return s.user.ResetPassword(ctx, &uservl.ResetPasswordRequest{
        Email: req.GetEmail(), Code: req.GetCode(), NewPassword: req.GetNewPassword(),
        RegionCode: req.GetRegionCode(), Phone: req.GetPhone(),
    })
}
```

handler 一行委托；`pkg/server.go` 公开白名单追加 `"/testkit.v1.TestKitService/ResetPassword"`（无 JWT 调用）。

- [ ] **Step 3: 前端** — 在 Profile 页加「修改密码」ModalForm（`changePassword`）、登录页「忘记密码」入口调 `resetPassword`（两个生成函数）。enumeration 不展开 TSX，按 Task 2 Profile 页模式套用。

- [ ] **Step 4: `make proto` + `go test ./internal/service/user/...`（补 stub 的 ChangePassword/ResetPassword 覆写 + 断言 user_id 注入）+ Commit。**

```bash
git add -A && git commit -m "feat(user): ChangePassword/ResetPassword"
```

---

## Task 7 (Enumeration — Identity): ListIdentities / BindIdentity / BindOAuthIdentity / UnbindIdentity

「我的」类：前三个 user_id 从 ctx 注入；UnbindIdentity 的 `identity_id` 是目标 ID（保留），user_id 从 ctx 注入。

- [ ] **Step 1: proto**

```proto
message ListIdentitiesRequest {}                      // user_id from ctx
message ListIdentitiesResponse { repeated Identity identities = 1; }

message BindIdentityRequest {
  IdentityProvider provider = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  string email = 2 [(buf.validate.field).string.max_len = 256];
  string code = 3 [(buf.validate.field).string = {min_len: 1, max_len: 16}];
  string password = 4 [(buf.validate.field).string.max_len = 128];
  string region_code = 5 [(buf.validate.field).string.pattern = "^[A-Z]{2}$"];
  string phone = 6 [(buf.validate.field).string.max_len = 20];
  option (buf.validate.message).cel = {
    id: "target_exclusive", message: "exactly one of email or region_code+phone must be set",
    expression: "(this.email != '' && this.region_code == '' && this.phone == '') || (this.email == '' && this.region_code != '' && this.phone != '')"
  };
}

message BindOAuthIdentityRequest {
  IdentityProvider provider = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0, 1, 2]}]; // OAuth only
  string code = 2 [(buf.validate.field).string = {min_len: 1, max_len: 512}];
  string state = 3 [(buf.validate.field).string = {min_len: 1, max_len: 128}];
}
message BindOAuthIdentityResponse { Identity identity = 1; }

message UnbindIdentityRequest {
  int64 identity_id = 1 [(buf.validate.field).int64.gt = 0]; // target identity
  string code = 2 [(buf.validate.field).string = {min_len: 1, max_len: 16}];
  // user_id injected from ctx
}
```

```proto
  rpc ListIdentities(ListIdentitiesRequest) returns (ListIdentitiesResponse) {
    option (google.api.http) = { get: "/api/v1/identities" };
  }
  rpc BindIdentity(BindIdentityRequest) returns (Identity) {
    option (google.api.http) = { post: "/api/v1/identities" body: "*" };
  }
  rpc BindOAuthIdentity(BindOAuthIdentityRequest) returns (BindOAuthIdentityResponse) {
    option (google.api.http) = { post: "/api/v1/identities/oauth" body: "*" };
  }
  rpc UnbindIdentity(UnbindIdentityRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/identities/{identity_id}" body: "*" };
  }
```

- [ ] **Step 2: service.go 方法 + converter + 下游 target**

```go
// ListIdentities — user_id from ctx. Down: uservl.ListIdentitiesRequest{user_id}.
// resp: toTestkitIdentity on each (define toTestkitIdentity here).
func toTestkitIdentity(i *uservl.Identity) *testkitv1.Identity {
    if i == nil { return nil }
    return &testkitv1.Identity{
        Id: i.GetId(), Provider: testkitv1.IdentityProvider(i.GetProvider()),
        ProviderUid: i.GetProviderUid(), Verified: i.GetVerified(), CreatedAt: i.GetCreatedAt(),
    }
}
// ListIdentities / BindIdentity / BindOAuthIdentity: read userID via userIDFromCtx,
// set UserId on the downstream request, forward, map resp via toTestkitIdentity.
// UnbindIdentity: UserID from ctx + IdentityId from req → uservl.UnbindIdentityRequest{user_id, identity_id, code}.
```

Converter signatures：
- `ListIdentities`: 内联 `&uservl.ListIdentitiesRequest{UserId: userID}`；resp 元素逐个 `toTestkitIdentity`。
- `BindIdentity`: 内联 `&uservl.BindIdentityRequest{user_id: userID, provider, email, code, password, region_code, phone}`（enum 直转）。
- `BindOAuthIdentity`: `&uservl.BindOAuthIdentityRequest{user_id: userID, provider, code, state}`。
- `UnbindIdentity`: `&uservl.UnbindIdentityRequest{user_id: userID, identity_id, code}`。

四个均「先 `userIDFromCtx` → 填下游 `user_id` → 转发 → `toTestkitIdentity`」。

- [ ] **Step 3: 前端** — `web/src/pages/Identity/index.tsx`：ProTable 展示 identities（调 `listIdentities`）+ 「绑定邮箱/手机」ModalForm（`bindIdentity`）+ Unbind Popconfirm（`unbindIdentity`）。模式同 Task 5 Roles 页。

- [ ] **Step 4: `make proto` + 补单测 + Commit。**

```bash
git add -A && git commit -m "feat(user): identity binding (List/Bind/BindOAuth/Unbind)"
```

---

## Task 8 (Enumeration — Session): ListSessions / RevokeSession / RevokeAllSessions / GetSession / IssueSessionCode / ExchangeSessionCode

- [ ] **Step 1: proto**

```proto
message ListSessionsRequest {}                       // user_id from ctx
message ListSessionsResponse { repeated Session sessions = 1; }

message RevokeSessionRequest {
  string session_id = 1 [(buf.validate.field).string = {min_len: 1, max_len: 128}]; // target
}

message RevokeAllSessionsRequest {}                  // user_id from ctx

message GetSessionRequest {
  string session_id = 1 [(buf.validate.field).string = {min_len: 1, max_len: 128}];
}
message GetSessionResponse {
  int64 user_id = 1;
  google.protobuf.Timestamp expires_at = 2;
  google.protobuf.Timestamp created_at = 3;
  string ip = 4;
  string user_agent = 5;
  string os = 6;
  string browser = 7;
  string login_method = 8;
}

message IssueSessionCodeRequest {
  string session_id = 1 [(buf.validate.field).string = {min_len: 1, max_len: 128}];
}
message IssueSessionCodeResponse { string code = 1; }

message ExchangeSessionCodeRequest {
  string code = 1 [(buf.validate.field).string = {min_len: 1, max_len: 128}];
}
message ExchangeSessionCodeResponse {
  string session_id = 1;
  int64 user_id = 2;
}
```

```proto
  rpc ListSessions(ListSessionsRequest) returns (ListSessionsResponse) {
    option (google.api.http) = { get: "/api/v1/sessions" };
  }
  rpc RevokeSession(RevokeSessionRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { post: "/api/v1/sessions/{session_id}/revoke" };
  }
  rpc RevokeAllSessions(RevokeAllSessionsRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { post: "/api/v1/sessions/revoke-all" };
  }
  rpc GetSession(GetSessionRequest) returns (GetSessionResponse) {
    option (google.api.http) = { get: "/api/v1/sessions/{session_id}" };
  }
  rpc IssueSessionCode(IssueSessionCodeRequest) returns (IssueSessionCodeResponse) {
    option (google.api.http) = { post: "/api/v1/sessions/issue-code" body: "*" };
  }
  rpc ExchangeSessionCode(ExchangeSessionCodeRequest) returns (ExchangeSessionCodeResponse) {
    option (google.api.http) = { post: "/api/v1/sessions/exchange" body: "*" };
  }
```

- [ ] **Step 2: service.go 方法 + converter + 下游 target**

Converter signatures / 下游 target：
- `ListSessions`: `userIDFromCtx` → `&uservl.ListSessionsRequest{UserId: userID}`；resp 元素 `toTestkitSession`（定义：把 `uservl.Session` 字段 1:1 映射，`device_type` enum 直转）。
- `RevokeSession`: `session_id` from req → `&uservl.RevokeSessionRequest{session_id}`。无 ctx 注入。
- `RevokeAllSessions`: `userIDFromCtx` → `&uservl.RevokeAllSessionsRequest{UserId: userID}`。
- `GetSession`: `&uservl.GetSessionRequest{session_id}` → resp 字段 1:1 映射为 `testkitv1.GetSessionResponse`（无 enum）。
- `IssueSessionCode`: `&uservl.IssueSessionCodeRequest{session_id}` → resp `{code}`。
- `ExchangeSessionCode`: `&uservl.ExchangeSessionCodeRequest{code}` → resp `{session_id, user_id}`。

```go
func toTestkitSession(s *uservl.Session) *testkitv1.Session {
    if s == nil { return nil }
    return &testkitv1.Session{
        Id: s.GetId(), Ip: s.GetIp(), DeviceType: testkitv1.DeviceType(s.GetDeviceType()),
        Os: s.GetOs(), Browser: s.GetBrowser(), Country: s.GetCountry(), City: s.GetCity(),
        CreatedAt: s.GetCreatedAt(), LastActiveAt: s.GetLastActiveAt(), Current: s.GetCurrent(),
    }
}
```

> 鉴权：`GetSession` / `IssueSessionCode` / `ExchangeSessionCode` 主要供 OAuth callback 服务 / BFF 内部使用——本期保持「需 JWT」（默认），在 `pkg/server.go` 备注：social 流程接入后若需服务间调用，再补 service-token 机制（不在 P2 范围）。`ExchangeSessionCode` 若被社交回调页（前端）调用，则加入公开白名单；默认不放。

- [ ] **Step 3: 前端** — `web/src/pages/Session/index.tsx`：ProTable 列出 sessions（`listSessions`），标记 `current`，Revoke 按钮（`revokeSession`）+「登出所有设备」（`revokeAllSessions`）。

- [ ] **Step 4: `make proto` + 单测 + Commit。**

```bash
git add -A && git commit -m "feat(user): session management (List/Revoke/RevokeAll/Get/IssueCode/ExchangeCode)"
```

---

## Task 9 (Enumeration — Social): GetOAuthURL / SocialLogin / MiniProgramLogin / MiniProgramPhoneLogin

SocialLogin/MiniProgramLogin/MiniProgramPhoneLogin 下游返回 `uservl.LoginResponse{user, session_id, is_new, return_to}`；testkit 消费 `session_id` 签 JWT，返回 `{token, user, is_new, return_to}`——与 P1 auth.Login 同构。需要 `s.jwt`（`user.New` 第二参）。

- [ ] **Step 1: proto**

```proto
message GetOAuthURLRequest {
  IdentityProvider provider = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  string return_to = 2 [(buf.validate.field).string.max_len = 512];
  string state = 3 [(buf.validate.field).string.max_len = 128];
}
message GetOAuthURLResponse {
  string url = 1;
  string state = 2;
}

message SocialLoginRequest {
  IdentityProvider provider = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  string code = 2 [(buf.validate.field).string = {min_len: 1}];
  string state = 3 [(buf.validate.field).string = {min_len: 1, max_len: 128}];
}

message MiniProgramLoginRequest {
  string code = 1 [(buf.validate.field).string = {min_len: 1}];
  string nickname = 2 [(buf.validate.field).string.max_len = 64];
  string avatar_url = 3 [(buf.validate.field).string.max_len = 512];
}

message MiniProgramPhoneLoginRequest {
  string login_code = 1 [(buf.validate.field).string = {min_len: 1}];
  string phone_code = 2 [(buf.validate.field).string = {min_len: 1}];
  string nickname = 3 [(buf.validate.field).string.max_len = 64];
  string avatar_url = 4 [(buf.validate.field).string.max_len = 512];
}

// SocialLoginResponse is the shared response for all social-login RPCs.
// token = testkit-issued JWT (consumes the downstream session_id); session_id
// itself is NOT returned to the frontend.
message SocialLoginResponse {
  string token = 1;
  User user = 2;
  bool is_new = 3;
  string return_to = 4; // meaningful only for SocialLogin (OAuth callback flow)
}
```

```proto
  rpc GetOAuthURL(GetOAuthURLRequest) returns (GetOAuthURLResponse) {
    option (google.api.http) = { get: "/api/v1/social/{provider}/url" };
  }
  rpc SocialLogin(SocialLoginRequest) returns (SocialLoginResponse) {
    option (google.api.http) = { post: "/api/v1/social/login" body: "*" };
  }
  rpc MiniProgramLogin(MiniProgramLoginRequest) returns (SocialLoginResponse) {
    option (google.api.http) = { post: "/api/v1/social/miniprogram" body: "*" };
  }
  rpc MiniProgramPhoneLogin(MiniProgramPhoneLoginRequest) returns (SocialLoginResponse) {
    option (google.api.http) = { post: "/api/v1/social/miniprogram/phone" body: "*" };
  }
```

- [ ] **Step 2: service.go 方法 + converter + 下游 target**

```go
// GetOAuthURL forwards as-is. Down: uservl.GetOAuthURLRequest{provider, return_to, state}.
// resp 1:1 {url, state}.

// socialToTokenResponse is the shared helper: consume downstream LoginResponse,
// sign a JWT over its session_id, map to SocialLoginResponse.
func (s *Service) socialToTokenResponse(resp *uservl.LoginResponse) (*testkitv1.SocialLoginResponse, error) {
    if s.jwt == nil {
        return nil, xcodes.ErrInternal.New("jwt manager not configured for social login")
    }
    token, err := s.jwt.Sign(resp.GetSessionId())
    if err != nil {
        return nil, xcodes.ErrInternal.Wrap(err)
    }
    return &testkitv1.SocialLoginResponse{
        Token: token, User: toTestkitUser(resp.GetUser()),
        IsNew: resp.GetIsNew(), ReturnTo: resp.GetReturnTo(),
    }, nil
}
```

四个方法：
- `GetOAuthURL`: `s.user.GetOAuthURL(ctx, &uservl.GetOAuthURLRequest{Provider:..., ReturnTo:..., State:...})` → `&testkitv1.GetOAuthURLResponse{Url, State}`。
- `SocialLogin`: `s.user.SocialLogin(ctx, &uservl.SocialLoginRequest{Provider, Code, State})` → `s.socialToTokenResponse(resp)`。
- `MiniProgramLogin`: `s.user.MiniProgramLogin(ctx, &uservl.MiniProgramLoginRequest{Code, Nickname, AvatarUrl})` → `s.socialToTokenResponse(resp)`。
- `MiniProgramPhoneLogin`: `s.user.MiniProgramPhoneLogin(ctx, &uservl.MiniProgramPhoneLoginRequest{LoginCode, PhoneCode, Nickname, AvatarUrl})` → `s.socialToTokenResponse(resp)`。

- [ ] **Step 3: 鉴权白名单** — `pkg/server.go` 的 `auth.WithPublicMethods(...)` 追加：`GetOAuthURL`、`SocialLogin`、`MiniProgramLogin`、`MiniProgramPhoneLogin`（用户未登录即调用）。

- [ ] **Step 4: 前端** — 「OAuth 登录」入口（登录页按钮 → `getOAuthURL({provider})` → `window.location = resp.url`；OAuth callback 页收 `code+state` 调 `socialLogin`，存 token）。小程序登录在前端小程序壳里调（web 端可选演示）。enumeration 不展开 TSX。

- [ ] **Step 5: `make proto` + 单测（stub 覆写 SocialLogin 返回 session_id，断言 resp.token 经 `s.jwt.Verify` 还原同一 session_id）+ Commit。**

```bash
git add -A && git commit -m "feat(user): social login (GetOAuthURL/SocialLogin/MiniProgram*); testkit issues JWT"
```

---

## Task 10 (Enumeration — Admin-Users 余下): CreateUser / ListUsers / GetLoginLogs

- [ ] **Step 1: proto**

```proto
message CreateUserRequest {
  UserType user_type = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  string username = 2 [(buf.validate.field).string.max_len = 64];
  string nickname = 3 [(buf.validate.field).string.max_len = 64];
  string real_name = 4 [(buf.validate.field).string.max_len = 64];
  string email = 5 [(buf.validate.field).string.max_len = 256];
  string region_code = 6 [(buf.validate.field).string.pattern = "^[A-Z]{2}$"];
  string phone = 7 [(buf.validate.field).string.max_len = 20];
  string password = 8 [(buf.validate.field).string = {min_len: 8, max_len: 128}];
  Gender gender = 9 [(buf.validate.field).enum.defined_only = true];
  string timezone = 10 [(buf.validate.field).string.max_len = 64];
  string locale = 11 [(buf.validate.field).string.max_len = 16];
}
message CreateUserResponse { User user = 1; }

message ListUsersRequest {
  UserStatus status = 1;
  string nickname = 2 [(buf.validate.field).string.max_len = 64];
  int32 page_size = 3 [(buf.validate.field).int32 = {gte: 1, lte: 100}];
  string cursor = 4 [(buf.validate.field).string.max_len = 64];
  Gender gender = 5;
  IdentityProvider register_source = 6;
  DeviceType register_device = 7;
  string locale = 8 [(buf.validate.field).string.max_len = 16];
  string timezone = 9 [(buf.validate.field).string.max_len = 64];
  string register_ip = 10 [(buf.validate.field).string.max_len = 45];
  string last_login_ip = 11 [(buf.validate.field).string.max_len = 45];
  google.protobuf.Timestamp created_at_start = 12;
  google.protobuf.Timestamp created_at_end = 13;
  google.protobuf.Timestamp last_login_at_start = 14;
  google.protobuf.Timestamp last_login_at_end = 15;
  repeated int64 user_ids = 16;
  string email = 17 [(buf.validate.field).string.max_len = 256];
  string region_code = 18 [(buf.validate.field).string.pattern = "^[A-Z]{2}$"];
  string phone = 19 [(buf.validate.field).string.max_len = 20];
  string username = 20 [(buf.validate.field).string.max_len = 64];
  UserType user_type = 21 [(buf.validate.field).enum.defined_only = true];
  UserSortField order_by = 22 [(buf.validate.field).enum.defined_only = true];
  bool descending = 23;
}
message ListUsersResponse {
  repeated User users = 1;
  string next_cursor = 2;
}

message GetLoginLogsRequest {
  int64 user_id = 1;                                   // optional filter (0 = all); kept
  IdentityProvider provider = 2;
  bool success = 3;
  int32 page_size = 4 [(buf.validate.field).int32 = {gte: 1, lte: 100}];
  string cursor = 5 [(buf.validate.field).string.max_len = 64];
}
message GetLoginLogsResponse {
  repeated LoginLog logs = 1;
  string next_cursor = 2;
  int32 total = 3;
}
```

```proto
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse) {
    option (google.api.http) = { post: "/api/v1/users" body: "*" };
  }
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse) {
    option (google.api.http) = { get: "/api/v1/users" };
  }
  rpc GetLoginLogs(GetLoginLogsRequest) returns (GetLoginLogsResponse) {
    option (google.api.http) = { get: "/api/v1/users/login-logs" };
  }
```

- [ ] **Step 2: service.go 方法 + converter + 下游 target**

Converter signatures / 下游 target（字段 1:1，enum 直转；无 ctx 注入，均 admin target）：
- `CreateUser`: `toUserCreateUserRequest(req)` → `&uservl.CreateUserRequest{user_type, username, nickname, real_name, email, region_code, phone, password, gender, timezone, locale}` → resp `toTestkitUser` 包进 `CreateUserResponse`。
- `ListUsers`: `toUserListUsersRequest(req)`（23 字段，仿 Task 4 `ToUserListUsersPagedRequest` 写法，去掉 page/page_size/count、保留 cursor + page_size）→ resp `toTestkitListUsersResponse`（`users` + `next_cursor`，逐个 `toTestkitUser`）。
- `GetLoginLogs`: `toUserGetLoginLogsRequest(req)` → `&uservl.GetLoginLogsRequest{user_id, provider, success, page_size, cursor}` → resp `toTestkitGetLoginLogsResponse`（逐个 `toTestkitLoginLog`）。

```go
func toTestkitLoginLog(l *uservl.LoginLog) *testkitv1.LoginLog {
    if l == nil { return nil }
    return &testkitv1.LoginLog{
        Id: l.GetId(), UserId: l.GetUserId(),
        Provider: testkitv1.IdentityProvider(l.GetProvider()),
        Action:   testkitv1.LoginAction(l.GetAction()),
        Success: l.GetSuccess(), FailReason: l.GetFailReason(), Ip: l.GetIp(),
        DeviceType: testkitv1.DeviceType(l.GetDeviceType()),
        Os: l.GetOs(), Browser: l.GetBrowser(), Country: l.GetCountry(), City: l.GetCity(),
        CreatedAt: l.GetCreatedAt(),
    }
}
```

- [ ] **Step 3: 前端** — User/List 页加「新建用户」ModalForm（`createUser`，字段对齐 proto）；新增 `web/src/pages/User/LoginLogs.tsx`（ProTable 调 `getLoginLogs`，可选 `user_id` 过滤）。`ListUsers`（游标）作为 ProTable 的「导出全量」后端可选，UI 主用 ListUsersPaged（Task 4）。

- [ ] **Step 4: `make proto` + 单测 + Commit。**

```bash
git add -A && git commit -m "feat(user): admin CreateUser/ListUsers/GetLoginLogs"
```

---

## Task 11 (Enumeration — RBAC-Group): 11 个 RPC

`group_id` / 目标 `user_id` / `role_id` 均保留（目标资源 ID）；`member.role` 字符串校验 `in: ["owner","admin","member"]`。

- [ ] **Step 1: proto**

```proto
// ---- RBAC-Group (P2) ----
message CreateGroupRequest {
  string name = 1 [(buf.validate.field).string = {min_len: 1, max_len: 64}];
  string description = 2 [(buf.validate.field).string.max_len = 512];
  int64 parent_id = 3;
}
message GetGroupRequest { int64 group_id = 1 [(buf.validate.field).int64.gt = 0]; }
message UpdateGroupRequest {
  int64 group_id = 1 [(buf.validate.field).int64.gt = 0];
  string name = 2 [(buf.validate.field).string.max_len = 64];
  string description = 3 [(buf.validate.field).string.max_len = 512];
}
message ListGroupsRequest {
  string status = 1 [(buf.validate.field).string.max_len = 32];
  int32 page_size = 2 [(buf.validate.field).int32 = {gte: 1, lte: 100}];
  string cursor = 3 [(buf.validate.field).string.max_len = 64];
}
message ListGroupsResponse {
  repeated Group groups = 1;
  string next_cursor = 2;
  int32 total = 3;
}
message DeleteGroupRequest { int64 group_id = 1 [(buf.validate.field).int64.gt = 0]; }
message AddGroupMemberRequest {
  int64 group_id = 1 [(buf.validate.field).int64.gt = 0];   // path
  int64 user_id = 2 [(buf.validate.field).int64.gt = 0];    // target member (kept)
  string role = 3 [(buf.validate.field).string = {in: ["owner","admin","member"]}];
}
message RemoveGroupMemberRequest {                    // group_id + user_id both from path
  int64 group_id = 1 [(buf.validate.field).int64.gt = 0];
  int64 user_id = 2 [(buf.validate.field).int64.gt = 0];
}
message ListGroupMembersRequest {
  int64 group_id = 1 [(buf.validate.field).int64.gt = 0];   // path
  string role = 2 [(buf.validate.field).string.max_len = 32];
  int32 page_size = 3 [(buf.validate.field).int32 = {gte: 1, lte: 100}];
  string cursor = 4 [(buf.validate.field).string.max_len = 64];
}
message ListGroupMembersResponse {
  repeated GroupMember members = 1;
  string next_cursor = 2;
  int32 total = 3;
}
message AddGroupRoleRequest {
  int64 group_id = 1 [(buf.validate.field).int64.gt = 0];   // path
  int64 role_id = 2 [(buf.validate.field).int64.gt = 0];
}
message RemoveGroupRoleRequest {                      // group_id + role_id from path
  int64 group_id = 1 [(buf.validate.field).int64.gt = 0];
  int64 role_id = 2 [(buf.validate.field).int64.gt = 0];
}
message ListGroupRolesRequest { int64 group_id = 1 [(buf.validate.field).int64.gt = 0]; }
message ListGroupRolesResponse { repeated Role roles = 1; }
```

```proto
  rpc CreateGroup(CreateGroupRequest) returns (Group) {
    option (google.api.http) = { post: "/api/v1/rbac/groups" body: "*" };
  }
  rpc GetGroup(GetGroupRequest) returns (Group) {
    option (google.api.http) = { get: "/api/v1/rbac/groups/{group_id}" };
  }
  rpc UpdateGroup(UpdateGroupRequest) returns (Group) {
    option (google.api.http) = { put: "/api/v1/rbac/groups/{group_id}" body: "*" };
  }
  rpc ListGroups(ListGroupsRequest) returns (ListGroupsResponse) {
    option (google.api.http) = { get: "/api/v1/rbac/groups" };
  }
  rpc DeleteGroup(DeleteGroupRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/rbac/groups/{group_id}" };
  }
  rpc AddGroupMember(AddGroupMemberRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { post: "/api/v1/rbac/groups/{group_id}/members" body: "*" };
  }
  rpc RemoveGroupMember(RemoveGroupMemberRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/rbac/groups/{group_id}/members/{user_id}" };
  }
  rpc ListGroupMembers(ListGroupMembersRequest) returns (ListGroupMembersResponse) {
    option (google.api.http) = { get: "/api/v1/rbac/groups/{group_id}/members" };
  }
  rpc AddGroupRole(AddGroupRoleRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { post: "/api/v1/rbac/groups/{group_id}/roles" body: "*" };
  }
  rpc RemoveGroupRole(RemoveGroupRoleRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/rbac/groups/{group_id}/roles/{role_id}" };
  }
  rpc ListGroupRoles(ListGroupRolesRequest) returns (ListGroupRolesResponse) {
    option (google.api.http) = { get: "/api/v1/rbac/groups/{group_id}/roles" };
  }
```

- [ ] **Step 2: service.go 方法 + converter + 下游 target**

```go
func toTestkitGroup(g *uservl.Group) *testkitv1.Group {
    if g == nil { return nil }
    return &testkitv1.Group{
        Id: g.GetId(), Name: g.GetName(), Description: g.GetDescription(),
        ParentId: g.GetParentId(), Status: g.GetStatus(), MemberCount: g.GetMemberCount(),
        CreatedAt: g.GetCreatedAt(), UpdatedAt: g.GetUpdatedAt(),
    }
}
func toTestkitGroupMember(m *uservl.GroupMember) *testkitv1.GroupMember {
    if m == nil { return nil }
    return &testkitv1.GroupMember{
        UserId: m.GetUserId(), Nickname: m.GetNickname(), AvatarUrl: m.GetAvatarUrl(),
        Role: m.GetRole(), CreatedAt: m.GetCreatedAt(),
    }
}
```

下游 target（字段 1:1，路径参数与同名字段绑定）：
- `CreateGroup` → `&uservl.CreateGroupRequest{name, description, parent_id}` → `toTestkitGroup`。
- `GetGroup` → `{group_id}` → `toTestkitGroup`。
- `UpdateGroup` → `{group_id, name, description}` → `toTestkitGroup`。
- `ListGroups` → `{status, page_size, cursor}` → `toTestkitListGroupsResponse`（逐个 `toTestkitGroup` + `next_cursor` + `total`）。
- `DeleteGroup` → `{group_id}` → Empty。
- `AddGroupMember` → `{group_id, user_id, role}` → Empty。
- `RemoveGroupMember` → `{group_id, user_id}`（均 path）→ Empty。
- `ListGroupMembers` → `{group_id, role, page_size, cursor}` → `toTestkitListGroupMembersResponse`（逐个 `toTestkitGroupMember`）。
- `AddGroupRole` → `{group_id, role_id}` → Empty。
- `RemoveGroupRole` → `{group_id, role_id}` → Empty。
- `ListGroupRoles` → `{group_id}` → `toTestkitListGroupRolesResponse`（逐个 `toTestkitRole`，复用 Task 5）。

- [ ] **Step 3: 前端** — `web/src/pages/Rbac/Groups.tsx`：ProTable（`listGroups`）+ 新建/编辑 ModalForm（`createGroup`/`updateGroup`）+ 行内「成员」「角色」抽屉（`listGroupMembers`/`addGroupMember`/`removeGroupMember` 与 `listGroupRoles`/`addGroupRole`/`removeGroupRole`）。

- [ ] **Step 4: `make proto` + 单测 + Commit。**

```bash
git add -A && git commit -m "feat(user): RBAC group management (11 RPCs)"
```

---

## Task 12 (Enumeration — RBAC-Role 余下): GetRole / UpdateRole / DeleteRole / AssignRole / RevokeRole / ListUserRoles

- [ ] **Step 1: proto**

```proto
message GetRoleRequest { int64 role_id = 1 [(buf.validate.field).int64.gt = 0]; }
message UpdateRoleRequest {
  int64 role_id = 1 [(buf.validate.field).int64.gt = 0];
  string name = 2 [(buf.validate.field).string.max_len = 64];
  string description = 3 [(buf.validate.field).string.max_len = 512];
  repeated int64 permission_ids = 4;
  repeated int64 permission_group_ids = 5;
}
message DeleteRoleRequest { int64 role_id = 1 [(buf.validate.field).int64.gt = 0]; }
message AssignRoleRequest {
  int64 user_id = 1 [(buf.validate.field).int64.gt = 0];   // target user (path)
  int64 role_id = 2 [(buf.validate.field).int64.gt = 0];
}
message RevokeRoleRequest {                              // user_id + role_id from path
  int64 user_id = 1 [(buf.validate.field).int64.gt = 0];
  int64 role_id = 2 [(buf.validate.field).int64.gt = 0];
}
message ListUserRolesRequest { int64 user_id = 1 [(buf.validate.field).int64.gt = 0]; }
message ListUserRolesResponse { repeated UserRole roles = 1; }
```

```proto
  rpc GetRole(GetRoleRequest) returns (Role) {
    option (google.api.http) = { get: "/api/v1/rbac/roles/{role_id}" };
  }
  rpc UpdateRole(UpdateRoleRequest) returns (Role) {
    option (google.api.http) = { put: "/api/v1/rbac/roles/{role_id}" body: "*" };
  }
  rpc DeleteRole(DeleteRoleRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/rbac/roles/{role_id}" };
  }
  rpc AssignRole(AssignRoleRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { post: "/api/v1/rbac/users/{user_id}/roles" body: "*" };
  }
  rpc RevokeRole(RevokeRoleRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/rbac/users/{user_id}/roles/{role_id}" };
  }
  rpc ListUserRoles(ListUserRolesRequest) returns (ListUserRolesResponse) {
    option (google.api.http) = { get: "/api/v1/rbac/users/{user_id}/roles" };
  }
```

- [ ] **Step 2: service.go 方法 + converter + 下游 target**

```go
func toTestkitUserRole(r *uservl.UserRole) *testkitv1.UserRole {
    if r == nil { return nil }
    return &testkitv1.UserRole{
        Id: r.GetId(), RoleId: r.GetRoleId(), RoleName: r.GetRoleName(),
        Source: r.GetSource(), CreatedAt: r.GetCreatedAt(),
    }
}
```

下游 target：
- `GetRole` → `{role_id}` → `toTestkitRole`（Task 5 已定义）。
- `UpdateRole` → `{role_id, name, description, permission_ids, permission_group_ids}` → `toTestkitRole`。
- `DeleteRole` → `{role_id}` → Empty。
- `AssignRole` → `{user_id, role_id}`（user_id path）→ Empty。
- `RevokeRole` → `{user_id, role_id}`（均 path）→ Empty。
- `ListUserRoles` → `{user_id}`（path）→ `toTestkitListUserRolesResponse`（逐个 `toTestkitUserRole`）。

> **`UserClient` 接口汇总（可选采纳）**：若执行者偏好显式小接口而非直接用 `uservl.UserServiceServer`（见「关键决策 3」），P2 全量方法签名 = 上述所有 worked + enumeration 方法在 `uservl.UserServiceServer` 上的子集。为简洁起见本计划不逐行罗列 53 条签名——以 `uservl.UserServiceServer` 为唯一权威来源，`go build` 会强制 `user.go` 调用的每个方法都存在。

- [ ] **Step 3: 前端** — `web/src/pages/Rbac/Roles.tsx`（Task 5）扩展行内操作：编辑（`updateRole`）/ 删除（`deleteRole`）；新增「用户角色」标签页 `web/src/pages/Rbac/UserRoles.tsx`：按 user_id 查（`listUserRoles`）+ Assign/Revoke（`assignRole`/`revokeRole`）。

- [ ] **Step 4: `make proto` + 单测 + Commit。**

```bash
git add -A && git commit -m "feat(user): RBAC role CRUD + user-role assignment"
```

---

## Task 13 (Enumeration — RBAC-Permission): 10 个 RPC

- [ ] **Step 1: proto**

```proto
// ---- RBAC-Permission (P2) ----
message ListPermissionsRequest {
  int32 page_size = 1 [(buf.validate.field).int32 = {gte: 1, lte: 100}];
  string cursor = 2 [(buf.validate.field).string.max_len = 64];
}
message ListPermissionsResponse {
  repeated Permission permissions = 1;
  string next_cursor = 2;
  int32 total = 3;
}
message CreatePermissionRequest {
  string resource = 1 [(buf.validate.field).string = {min_len: 1, max_len: 64}];
  string action = 2 [(buf.validate.field).string = {min_len: 1, max_len: 32}];
  string description = 3 [(buf.validate.field).string.max_len = 256];
}
message GetPermissionRequest { int64 permission_id = 1 [(buf.validate.field).int64.gt = 0]; }
message UpdatePermissionRequest {
  int64 permission_id = 1 [(buf.validate.field).int64.gt = 0];
  string resource = 2 [(buf.validate.field).string.max_len = 64];
  string action = 3 [(buf.validate.field).string.max_len = 32];
  string description = 4 [(buf.validate.field).string.max_len = 256];
}
message DeletePermissionRequest { int64 permission_id = 1 [(buf.validate.field).int64.gt = 0]; }

message CreatePermissionGroupRequest {
  string name = 1 [(buf.validate.field).string = {min_len: 1, max_len: 64}];
  string description = 2 [(buf.validate.field).string.max_len = 512];
  repeated int64 permission_ids = 3;
}
message GetPermissionGroupRequest { int64 permission_group_id = 1 [(buf.validate.field).int64.gt = 0]; }
message UpdatePermissionGroupRequest {
  int64 permission_group_id = 1 [(buf.validate.field).int64.gt = 0];
  string name = 2 [(buf.validate.field).string.max_len = 64];
  string description = 3 [(buf.validate.field).string.max_len = 512];
  repeated int64 permission_ids = 4;
}
message DeletePermissionGroupRequest { int64 permission_group_id = 1 [(buf.validate.field).int64.gt = 0]; }
message ListPermissionGroupsRequest {
  int32 page_size = 1 [(buf.validate.field).int32 = {gte: 1, lte: 100}];
  string cursor = 2 [(buf.validate.field).string.max_len = 64];
}
message ListPermissionGroupsResponse {
  repeated PermissionGroup groups = 1;
  string next_cursor = 2;
  int32 total = 3;
}
```

```proto
  rpc ListPermissions(ListPermissionsRequest) returns (ListPermissionsResponse) {
    option (google.api.http) = { get: "/api/v1/rbac/permissions" };
  }
  rpc CreatePermission(CreatePermissionRequest) returns (Permission) {
    option (google.api.http) = { post: "/api/v1/rbac/permissions" body: "*" };
  }
  rpc GetPermission(GetPermissionRequest) returns (Permission) {
    option (google.api.http) = { get: "/api/v1/rbac/permissions/{permission_id}" };
  }
  rpc UpdatePermission(UpdatePermissionRequest) returns (Permission) {
    option (google.api.http) = { put: "/api/v1/rbac/permissions/{permission_id}" body: "*" };
  }
  rpc DeletePermission(DeletePermissionRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/rbac/permissions/{permission_id}" };
  }
  rpc CreatePermissionGroup(CreatePermissionGroupRequest) returns (PermissionGroup) {
    option (google.api.http) = { post: "/api/v1/rbac/permission-groups" body: "*" };
  }
  rpc GetPermissionGroup(GetPermissionGroupRequest) returns (PermissionGroup) {
    option (google.api.http) = { get: "/api/v1/rbac/permission-groups/{permission_group_id}" };
  }
  rpc UpdatePermissionGroup(UpdatePermissionGroupRequest) returns (PermissionGroup) {
    option (google.api.http) = { put: "/api/v1/rbac/permission-groups/{permission_group_id}" body: "*" };
  }
  rpc DeletePermissionGroup(DeletePermissionGroupRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/rbac/permission-groups/{permission_group_id}" };
  }
  rpc ListPermissionGroups(ListPermissionGroupsRequest) returns (ListPermissionGroupsResponse) {
    option (google.api.http) = { get: "/api/v1/rbac/permission-groups" };
  }
```

- [ ] **Step 2: service.go 方法 + converter + 下游 target**

`toTestkitPermission` / `toTestkitPermissionGroup` 已在 Task 5 Step 5 定义并复用。下游 target（字段 1:1）：
- `ListPermissions` → `{page_size, cursor}` → `toTestkitListPermissionsResponse`（逐个 `toTestkitPermission`）。
- `CreatePermission` → `{resource, action, description}` → `toTestkitPermission`。
- `GetPermission` → `{permission_id}` → `toTestkitPermission`。
- `UpdatePermission` → `{permission_id, resource, action, description}` → `toTestkitPermission`。
- `DeletePermission` → `{permission_id}` → Empty。
- `CreatePermissionGroup` → `{name, description, permission_ids}` → `toTestkitPermissionGroup`。
- `GetPermissionGroup` → `{permission_group_id}` → `toTestkitPermissionGroup`。
- `UpdatePermissionGroup` → `{permission_group_id, name, description, permission_ids}` → `toTestkitPermissionGroup`。
- `DeletePermissionGroup` → `{permission_group_id}` → Empty。
- `ListPermissionGroups` → `{page_size, cursor}` → `toTestkitListPermissionGroupsResponse`（逐个 `toTestkitPermissionGroup`）。

三个 list response converter 写法仿 Task 5 `toTestkitListRolesResponse`。

- [ ] **Step 3: 前端** — `web/src/pages/Rbac/Permissions.tsx`（权限列表，内置/自定义标签，`listPermissions`/`createPermission`/`updatePermission`/`deletePermission`）；`web/src/pages/Rbac/PermissionGroups.tsx`（权限组，同构）。CreateRole/UpdateRole 的 `permission_ids` 多选下拉数据源用 `listPermissions` 全量拉取。

- [ ] **Step 4: `make proto` + 单测 + Commit。**

```bash
git add -A && git commit -m "feat(user): RBAC permission + permission-group CRUD"
```

---

## Task 14: 前端路由 + 菜单 + openapi 统一重生

- [ ] **Step 1: 统一重生 services/类型**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto
cd web && npm run openapi
```

Expected: `src/services/testkit/` 含全部 54 个 P2 RPC 的请求函数；`typings.d.ts` 含 `API.User` / `API.Role` / `API.Group` / `API.Permission` / `API.Session` / `API.Identity` / 各 Request/Response。

- [ ] **Step 2: 路由 + 菜单**

`web/config/routes.ts` 追加（ProLayout 菜单项）：

```ts
export default [
  // ... P1 routes (/User/Login, /) ...
  { path: '/profile', name: '个人资料', component: './Profile' },
  {
    path: '/user', name: '用户运营', routes: [
      { path: '/user/list', name: '用户列表', component: './User/List' },
      { path: '/user/login-logs', name: '登录日志', component: './User/LoginLogs' },
    ],
  },
  { path: '/identity', name: '登录方式', component: './Identity' },
  { path: '/session', name: '会话管理', component: './Session' },
  {
    path: '/rbac', name: '权限管理', routes: [
      { path: '/rbac/users', name: '用户角色', component: './Rbac/UserRoles' },
      { path: '/rbac/roles', name: '角色', component: './Rbac/Roles' },
      { path: '/rbac/groups', name: '用户组', component: './Rbac/Groups' },
      { path: '/rbac/permissions', name: '权限', component: './Rbac/Permissions' },
      { path: '/rbac/permission-groups', name: '权限组', component: './Rbac/PermissionGroups' },
    ],
  },
];
```

- [ ] **Step 3: 验证前端构建**

```bash
npm run build
```

Expected: PASS（无类型错误；所有页面 import 的 service 函数都已生成）。

- [ ] **Step 4: Commit**

```bash
cd /Users/moss/code/servekit/testkit-service
git add -A
git commit -m "feat(web): P2 routes + menu, regenerate openapi services"
```

---

## Task 15: 验收 + lint + 端到端

- [ ] **Step 1: 全量构建 + lint**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto && go build ./...
golangci-lint run ./...
go test -race -coverprofile=coverage.out ./...
```

Expected: 全绿；`internal/service/user/` 覆盖率 ≥ 80%（mapping + 转发覆盖）。

- [ ] **Step 2: proto 自包含校验**

```bash
grep -n '^import' api/proto/testkit/v1/testkit.proto
# Expected: 仅 google/api/annotations、google/protobuf/*、buf/validate/validate —— 不命中任何下游 .proto
```

- [ ] **Step 3: 端到端**

```bash
docker compose up --build -d
# 浏览器 http://localhost:8080 → 登录 → 个人资料编辑 → 用户列表(禁用) → 角色列表(新建) → 会话管理(吊销)
```

Expected: 各页面用生成的 service 调通；`localStorage.testkit_token` 持续有效；禁用用户后该用户再次登录被拒（下游 user-service 业务校验）。

- [ ] **Step 4: Commit（如有 lint 修复）**

```bash
git add -A && git commit -m "chore(user): P2 lint + e2e verification"
```

> **RBAC 鉴权本期不做**：admin 端点（CreateUser/DisableUser/Create*/Update*/Delete*/Assign*/...）**不叠加** permission 校验——user-service 的 RBAC 现阶段只做 CRUD、不做鉴权落地，后续权限控制统一用 OPA（v2 spec §3.5/§12、本计划决策 4）。故本 Task **不**加 `checkPerm`/`CheckPermission` 之类逻辑，admin 仅登录态 + 身份注入；前端 admin 页对所有登录用户可见（`access: 'canUser'`）。OPA 接入是未来独立工作，非 P2 范围。

---

## 验收检查（P2 完成时跑）

- [ ] `go build ./...` + `golangci-lint run ./...` 通过
- [ ] `make proto && git diff --exit-code`（生成产物一致、已提交）
- [ ] `api/swagger/testkit/v1/testkit.swagger.json` 含全部 54 个 P2 RPC 的 path/operationId
- [ ] testkit.proto **不 import 任何下游 proto**（`grep '^import'` 仅命中 google/buf 标准件）
- [ ] `go test -race ./...` 全绿；user 域 mapping 单测覆盖 4 个 worked 子模式
- [ ] 「我的」类 9 个 RPC 的 request message **不含 `user_id`** 字段（`grep -A5 'message GetProfileRequest'` 等）；admin 类 request 保留 target ID
- [ ] 所有 P2 enum 字段用镜像 enum（int 直转），无 string 硬编码
- [ ] 前端 `npm run openapi` 生成全部 P2 services；各页面无手写 fetch（`grep -rn 'fetch\|axios' web/src/pages` 应无命中）
- [ ] docker-compose 全栈下，profile/用户列表/角色/会话页面端到端可用

---

## Self-Review

**覆盖度 vs spec §7（P2 = user 全套，~55 RPC）：**
- 本计划覆盖 **53 个转发型 testkit RPC**（GetSession 计入为「可选内部辅助」）= user-service 59 RPC − P1 已做 5 个 auth RPC − 1 个 Ping（testkit 自有）。
  - Profile 4 / Identity 4 / Session 6 / Social 4 / Admin-Users 6 / RBAC-Group 11 / RBAC-Role 8 / RBAC-Permission 10。
- 4 个 worked TDD task 覆盖 4 个子模式：(1) ctx 注入「我的」资源（GetProfile/UpdateProfile）；(2) 目标 ID admin（GetUser/DisableUser）；(3) 分页列表 + 排序 + 过滤（ListUsersPaged）；(4) RBAC create + cursor list（CreateRole/ListRoles）。其余 49 个 RPC 由 Task 6–13 的 enumeration 完整定义 proto + converter 签名 + 下游 target，套用 worked 模式即可。
- 前端：4 个子域（Profile / User 运营 / Rbac Roles / 共用列表）有完整 TSX；Identity / Session / Rbac Groups/Permissions/UserRoles / LoginLogs 由 enumeration 给出页面规格 + 复用同构 ProTable/ModalForm 模式。

**裁剪规则合规（v2 §3.2）：**
- 9 个「我的」RPC 去掉调用方 user_id（Task 2/6/7/8）；目标 ID（user_id/identity_id/session_id/group_id/role_id/permission_id/permission_group_id）全部保留（Task 3/10/11/12/13）。
- 无 `owner`/`owner_type`/`owner_id`（user-service 此批 RPC 本就不带 owner，无字段可去）。
- 纯内部字段（如 uservl 的 debug 字段）无暴露——testkit 实体 message 仅含前端可见字段。
- 全部 enum 在 testkit 重新定义并镜像下游同名同号；映射整型直转。

**类型 / 命名一致性：**
- Converter 命名：testkit→downstream 统一 `toUser<Method>Request`（Task 4 的 `ToUserListUsersPagedRequest` 因单测直访而导出，其余 unexported）；downstream→testkit 统一 `toTestkit<Entity>`（toTestkitUser/Identity/Session/Group/Role/Permission/PermissionGroup/GroupMember/LoginLog/UserRole/ListUsersPagedResponse/ListRolesResponse/...）。与 P1 Task 13 命名约定一致（P1 prose 写 `<method>ReqTo<DownSvc>`，实际代码用 `toUser<Method>Request`——以 P1 Task 13 实际代码为准，本计划沿用）。
- `UserClient` 用 `uservl.UserServiceServer`（关键决策 3，已声明偏离 P1 小接口模式）；`user.New(userClient, jwtMgr, opts...)`；`service.go` 持 `userSvc *user.Service` + `User()` accessor（避免与 P1 的 `user *user.Handler` 字段重名）。
- 错误：下游 xerr 透传；testkit 自身仅 `xcodes.ErrUnauthorized`（ctx 缺 user_id）与 `xcodes.ErrInternal`（social 缺 jwt）——均为 go-common 预置，无新 xcode。

**Placeholder 扫描：** 无 TBD/TODO/「类似 Task N」——每个 enumeration task 的 proto message 字段、校验、converter 签名、下游 target、REST 路径、前端页面规格均已给出完整定义；worked task 的代码均为完整可编译块。唯一「留给执行者按实际调整」的是 `npm run openapi` 生成函数名（oneapi 引擎对 operationId 的大小写/尾缀处理），已在 Task 2 Step 10 显式说明判断方法，非占位符。

**潜在风险 / 偏差：**
1. **RBAC 鉴权应用本期不做**（user-service RBAC 现只做 CRUD，后续统一用 OPA；见 v2 spec §3.5/§12、本计划决策 4）。admin 端点仅登录态 + 身份注入，无 permission 校验；RBAC CRUD 管理 UI 做全。**非 P2 范围**，不列为硬化项。
2. `GetSession`/`IssueSessionCode`/`ExchangeSessionCode` 的服务间鉴权（OAuth callback service 调用）未定，本期默认走用户 JWT；social 流程接入时可能需 service-token 机制（P5/P6 范围）。
3. P1 计划写 `xerr.CategoryUnauthenticated`，实际 go-common 是 `CategoryUnauthorized`——本计划用预置 `xcodes.ErrUnauthorized`，执行 P1 时亦应同步修正。

---

## 关联

**设计文档：**
- [[2026-07-29-testkit-service-design]]（v2，自包含 proto + 映射层 + swagger + 前端 codegen；§3 映射层、§3.2 裁剪规则、§7 功能清单、§8 分期）
- [[2026-07-28-testkit-service-design]]（v1，地基章节仍有效）

**前置计划：**
- [[2026-07-28-testkit-service-p1-foundation]]（P1 地基 + 认证闭环；Task 5 thirdcall、Task 8 service.go 构造、Task 11 AuthInterceptor、Task 12 proto 镜像 enum、Task 13 service 域 + 映射 + 单测、Task 14 handler + facade 接入——本 P2 直接复用这些模式）

**后续计划：**
- P3 文件 → `docs/superpowers/plans/2026-07-29-testkit-service-p3-storage.md`
- P4 消息 → `docs/superpowers/plans/2026-07-29-testkit-service-p4-message.md`
- P5 gid + 仪表盘 → `docs/superpowers/plans/2026-07-29-testkit-service-p5-gid-dashboard.md`
- P6 扩展 → `docs/superpowers/plans/2026-07-29-testkit-service-p6-extension.md`

**相关服务 / 下游 proto：**
- `user-service/api/proto/user/v1/user.proto`（59 RPC / 90 message / 10 enum——P2 镜像其 enum 并裁剪其 message）

**遵循 skill：**
- `golang-service-development`（架构 / api-swagger / 第三方 thirdcall）
- `proto-development`（proto 写法 / protovalidate / buf）
- `golang-development`（Go 风格 / lint / 文件内排列）
