# testkit-service P5（gid 调试 + 仪表盘）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 testkit-service 补齐最后一块功能——gid 调试面板（NextID / BatchNextID / Decompose 三个 1:1 转发 RPC）+ 全局仪表盘（GetDashboard 聚合 message/storage/user 四下游），并交付对应前端两页（gid 调试 + 仪表盘 KPI/图表），收尾 spec §7 的 P5 行。

**Architecture:** gid 域是标准 1:1 转发型——testkit 自有 message 镜像 `gid.proto`（gid RPC 无调用方身份字段，故 near-1:1），`internal/service/gid/gid.go` 做整型直转。dashboard 域是 spec §10 的「聚合型」范例：`GetDashboard` 用 `golang.org/x/sync/errgroup` 并发 fan-out 调 `message.GetEmailStats` + `message.GetSMSStats` + `storage.GetMyQuota` + `user.ListUsersPaged`，**fail-fast**（任一下游出错即返回首个错误，xerr 透传 v2 §9），组装自定义 `DashboardResponse`；`GetMyQuota` 的 `Owner` 由 ctx 注入（v2 §3.2 rule 1，request message 不含越权字段）。两个域的映射层是 testkit 里唯一 import 对应下游 `gen/` 的地方（gidv1；messagev1/storagev1/userv1）。

**Tech Stack:** Go 1.26 + go-common（grpcx / xerr）+ `golang.org/x/sync/errgroup`；前端 Ant Design Pro v6（React 19 + antd 6 + Umi Max 4）+ `@ant-design/charts`。

---

## 关键决策与依据（实现前必读）

1. **并发用 `golang.org/x/sync/errgroup`，不用 `go-common/gorx`。**
   - 依据：`go-common/gorx.RoutineGroup.Run(fn func())` 的入参是 `func()`（无 error 返回），`Wait()` 也不返回 error——它是带 panic recovery 的「发射后不管」goroutine 组，**不收集错误**，无法做 fail-fast 错误捕获。
   - `errgroup.WithContext(ctx)` + `g.Go(func() error)` + `g.Wait()` 返回首个错误，且派生 ctx 在首个错误时取消其余 goroutine——正好是 BFF 聚合的标准 fail-fast 语义。故选 errgroup。

2. **聚合的错误策略选 fail-fast，不选 best-effort。**
   - 依据：(a) 与 testkit「下游 xerr.Error 透传」哲学一致（v2 §9）；(b) 无需为部分失败引入「成功字段 + 缺失哨兵」的复杂响应形状；(c) 避免给运营者呈现半空的仪表盘而误导判断（例如配额显示了但消息统计因下游故障缺失，容易被误读为「0 条邮件」）。
   - 取舍记录：best-effort（各字段独立容错、缺失置零并打日志）是更平滑的 UX，留作未来增强；P5 的聚合范例先做 fail-fast。

3. **gid RPC 镜像 1:1，dashboard message 自定义聚合。**
   - gid 三个 RPC 无调用方身份字段（gid.proto 全局唯一 ID 生成，与 caller 无关）→ testkit 自有 message 形状与 gid.proto 逐字一致（仅类型归属 `testkit.v1`）。
   - dashboard 是聚合产物：`DashboardResponse` 自定义，子结构（EmailStats/SMSStats/MyQuota/UsersSummary）镜像下游响应形状（只读快照，无身份字段可裁剪）；`EmailVendor`/`SmsVendor` 枚举在 testkit proto 重新定义（镜像 message.proto 同名同号，映射层整型直转，v2 §3.2 rule 3）。

4. **`GetMyQuota` 的 `Owner` 从 ctx 注入。**
   - storage.`GetMyQuotaRequest` 含 `Owner owner = 255`（高 field number 是下游对「调用方身份」字段的约定）。dashboard 读 `grpcx.GetUserIDFromCtx(ctx)`，构造 `Owner{OwnerType: OWNER_TYPE_USER, OwnerId: userID}` 注入下游请求；testkit 的 `GetDashboardRequest` 是空的——前端无法在协议层指定越权目标（v2 §3.2 rule 1，BFF 是唯一信任边界）。

5. **service.go import 别名避免与 thirdcall 冲突。**
   - P1 Task 8 已在 `internal/service/service.go` import `internal/thirdcall/gid`（包名 `gid`）。P5 新增的域包 `internal/service/gid`（包名也是 `gid`）与之冲突。故域包 import 用别名 `gidsvc`/`dashboardsvc`，字段 `gidSvc *gidsvc.Service` / `dashboardSvc *dashboardsvc.Service`，facade `Gid()`/`Dashboard()`。thirdcall 那一组（`gid`/`user`/`storage`/`message`）保持不动。

6. **int64 精度已由 P1 共享管线解决（P5 直接受益）。**
   - 雪花 ID 是 63-bit，超过 JS `Number.MAX_SAFE_INTEGER`（2^53）。proto3 JSON（grpc-gateway/protojson）把 int64 序列化成**字符串**保精度，但 openapi codegen 默认按 spec 的 `integer/int64` 生成 TS `number`，类型与线上值不符。
   - **P1 Task 17 的 codegen 管线已加 `web/scripts/fix-int64.js`**（`swagger2openapi` → `fix-int64.js` 把 int64 改写成 `string` → `max openapi`），全域（P2–P6）共享。故 P5 gid 调试页生成的 ID 类型是 `string`，与 protojson 一致、无精度丢失，gid 页**无需**再加精度注释。

---

## File Structure

P5 涉及的文件（创建/修改）：

```
testkit-service/
├── api/proto/testkit/v1/testkit.proto        # 追加 gid + dashboard 的 message/enum/RPC [改]
├── internal/service/
│   ├── service.go                            # 加 gid/dashboard 子服务 + facade [改]
│   ├── gid/gid.go                            # gid 域：1:1 转发 + 转换 [建]
│   ├── gid/gid_test.go                       # stub client 映射测试 [建]
│   ├── dashboard/dashboard.go                # dashboard 域：errgroup 聚合 + 转换 [建]
│   └── dashboard/dashboard_test.go           # stub clients 聚合/Owner 注入/fail-fast 测试 [建]
├── pkg/
│   ├── handler/testkit.go                    # 4 个 RPC 一行委托 [改]
│   └── xcodes/
│       ├── gid.go                            # 包文档（gid 无域级错误码，透传） [建]
│       └── dashboard.go                      # ErrCallerUnresolved [建]
└── web/
    ├── config/routes.ts                       # 加 /dashboard + /gid 路由 [改]
    └── src/pages/
        ├── Gid/Debug/index.tsx                # gid 调试页（单生/批生/解析） [建]
        └── Dashboard/index.tsx                # 仪表盘（KPI tiles + Pie/Progress） [建]
```

**职责边界**：`internal/service/gid` 与 `internal/service/dashboard` 是唯一 import 对应下游 gen（gidv1；messagev1/storagev1/userv1）的域包；`pkg/handler`、testkit proto/gen 只见 `testkitv1`。dashboard 不持有 `*Service` 引用，三个下游客户端由 `New` 注入。

---

## Task 1: proto 追加 gid + dashboard message/enum/RPC

gid 三 RPC 镜像 `gid-service/api/proto/gid/v1/gid.proto`（已核实）；dashboard 为自定义聚合 message。REST 前缀按 spec §7：`/api/v1/gid/*`、`/api/v1/dashboard`。

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`

- [ ] **Step 1: 追加 gid + dashboard 的 message/enum（文件末尾，`service TestKitService {}` 之后）**

在 `api/proto/testkit/v1/testkit.proto` 末尾追加（proto3 允许 message 在 service 块之后）：

```proto
// ---- GID debug (P5) ----
// Mirrors gid-service/api/proto/gid/v1/gid.proto 1:1. gid RPCs carry no
// caller-identity, so the testkit-owned messages are shape-identical (only the
// type ownership moves to testkit.v1). Mapping is a plain field copy.

message NextIDRequest {}

message NextIDResponse {
  int64 id = 1;
}

message BatchNextIDRequest {
  int32 count = 1 [(buf.validate.field).int32 = {gte: 1, lte: 1000}];
}

message BatchNextIDResponse {
  repeated int64 ids = 1;
}

message DecomposeRequest {
  int64 id = 1 [(buf.validate.field).int64 = {gte: 1}];
}

message DecomposeResponse {
  int64 time = 1;
  int64 sequence = 2;
  int64 machine_id = 3;
  string generated_at = 4; // ISO8601 timestamp
}

// ---- Dashboard (P5, aggregated) ----
// GetDashboard fans out to message.GetEmailStats + message.GetSMSStats +
// storage.GetMyQuota + user.ListUsersPaged concurrently and assembles this
// response. The caller's Owner (for GetMyQuota) is injected from ctx by the
// BFF — it is never present in GetDashboardRequest (v2 §3.2 rule 1).
// EmailVendor / SmsVendor mirror message.proto name-for-name and
// number-for-number so mapping is an int cast.

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

message GetDashboardRequest {}

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

message EmailStats {
  int64 total = 1;
  int64 sent = 2;
  int64 failed = 3;
  // success_rate in [0, 100]; -1 means "no data" (total == 0). Mirrors message.EmailStatsResponse.
  double success_rate = 4;
  repeated EmailVendorStats vendors = 5;
}

message SMSStats {
  int64 total = 1;
  int64 sent = 2;
  int64 failed = 3;
  double success_rate = 4;
  repeated SmsVendorStats vendors = 5;
}

message MyQuota {
  int64 total_bytes = 1;
  int64 used_bytes = 2;
  int64 available_bytes = 3;
  int32 file_count = 4;
}

message UsersSummary {
  int64 total = 1;
}

message DashboardResponse {
  EmailStats email_stats = 1;
  SMSStats sms_stats = 2;
  MyQuota quota = 3;
  UsersSummary users = 4;
}
```

> **跨期冲突兜底**：若 P4（消息域）已在 testkit.proto 定义过 `EmailVendor` / `SmsVendor`（消息发送筛选可能用同名 enum），则**删掉本 Task 里这两个 enum 块、复用 P4 已有的**，仅保留 `EmailVendorStats`/`SmsVendorStats`/`EmailStats`/`SMSStats`/`MyQuota`/`UsersSummary`/`DashboardResponse`/`GetDashboardRequest`。执行前先 `grep -n "enum EmailVendor\|enum SmsVendor" api/proto/testkit/v1/testkit.proto` 确认。

- [ ] **Step 2: 往 `service TestKitService { ... }` 块内追加 4 个 RPC**

在 service 块的最后一个现有 RPC 之后、闭合 `}` 之前插入：

```proto
  // ---- GID debug (P5) ----
  rpc NextID(NextIDRequest) returns (NextIDResponse) {
    option (google.api.http) = { get: "/api/v1/gid/next" };
  }

  rpc BatchNextID(BatchNextIDRequest) returns (BatchNextIDResponse) {
    option (google.api.http) = {
      post: "/api/v1/gid/batch"
      body: "*"
    };
  }

  rpc Decompose(DecomposeRequest) returns (DecomposeResponse) {
    option (google.api.http) = { get: "/api/v1/gid/decompose/{id}" };
  }

  // ---- Dashboard (P5, aggregated) ----
  rpc GetDashboard(GetDashboardRequest) returns (DashboardResponse) {
    option (google.api.http) = { get: "/api/v1/dashboard" };
  }
```

> GetDashboard 是**鉴权 RPC**（需要 caller user_id 注入 GetMyQuota 的 Owner）——**不**加入 AuthInterceptor 的公开白名单。gid 三 RPC 同样默认鉴权（调试工具置于登录态之后）。

- [ ] **Step 3: 重生成**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto
```

Expected: `gen/testkit/v1/` 含新 message/enum/RPC；`api/swagger/testkit/v1/testkit.swagger.json` 同步更新（paths 出现 `/api/v1/gid/next`、`/api/v1/gid/batch`、`/api/v1/gid/decompose/{id}`、`/api/v1/dashboard`）。

- [ ] **Step 4: 验证 proto 生成成功（构建预期失败）**

```bash
go build ./...
```

Expected: **FAIL**——`pkg/handler/testkit.go` 的 `Handler` 缺少 `NextID`/`BatchNextID`/`Decompose`/`GetDashboard` 方法，不满足扩容后的 `testkitv1.TestKitServiceServer` 接口（`UnimplementedTestKitServiceServer` 嵌入此时未覆盖这几个新方法）。此步仅确认 proto 生成无误；Task 4 会让它转绿。

- [ ] **Step 5: 确认 proto 自包含**

```bash
grep -n '^import' api/proto/testkit/v1/testkit.proto
```

Expected: 仅命中 `google/api/*`、`buf/validate/*`、`google/protobuf/*` 标准件——**无任何下游 proto import**（v2 §3.1 不变量保持）。

- [ ] **Step 6: Commit**

```bash
git add api/proto/ gen/ api/swagger/
git commit -m "feat(proto): add P5 gid debug + aggregated dashboard RPCs"
```

---

## Task 2: internal/service/gid 域（1:1 转发，TDD）

gid 三 RPC 是纯转发：testkit DTO ↔ gidv1 整型/字段直转，无 ctx 依赖。

**Files:**
- Create: `internal/service/gid/gid.go`
- Create: `internal/service/gid/gid_test.go`
- Create: `pkg/xcodes/gid.go`

- [ ] **Step 1: 写 gid 域测试（stub client 覆盖三 RPC 映射）**

`internal/service/gid/gid_test.go`：

```go
package gid_test

import (
	"context"
	"testing"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
	"github.com/servekit/testkit-service/internal/service/gid"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/stretchr/testify/require"
)

// stubClient implements gid.Client without a real gid handler.
type stubClient struct {
	nextID     int64
	ids        []int64
	decomposed *gidv1.DecomposeResponse
}

func (s *stubClient) NextID(ctx context.Context, req *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error) {
	return &gidv1.NextIDResponse{Id: s.nextID}, nil
}

func (s *stubClient) BatchNextID(ctx context.Context, req *gidv1.BatchNextIDRequest) (*gidv1.BatchNextIDResponse, error) {
	return &gidv1.BatchNextIDResponse{Ids: s.ids}, nil
}

func (s *stubClient) Decompose(ctx context.Context, req *gidv1.DecomposeRequest) (*gidv1.DecomposeResponse, error) {
	return s.decomposed, nil
}

func TestNextID_MapsResponse(t *testing.T) {
	svc := gid.New(&stubClient{nextID: 42})
	resp, err := svc.NextID(context.Background(), &testkitv1.NextIDRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(42), resp.GetId())
}

func TestBatchNextID_MapsResponse(t *testing.T) {
	svc := gid.New(&stubClient{ids: []int64{1, 2, 3}})
	resp, err := svc.BatchNextID(context.Background(), &testkitv1.BatchNextIDRequest{Count: 3})
	require.NoError(t, err)
	require.Equal(t, []int64{1, 2, 3}, resp.GetIds())
}

func TestDecompose_MapsAllFields(t *testing.T) {
	in := &gidv1.DecomposeResponse{
		Time:        1700000000000,
		Sequence:    5,
		MachineId:   7,
		GeneratedAt: "2026-07-29T00:00:00Z",
	}
	svc := gid.New(&stubClient{decomposed: in})
	resp, err := svc.Decompose(context.Background(), &testkitv1.DecomposeRequest{Id: 999})
	require.NoError(t, err)
	require.Equal(t, in.Time, resp.GetTime())
	require.Equal(t, in.Sequence, resp.GetSequence())
	require.Equal(t, in.MachineId, resp.GetMachineId())
	require.Equal(t, in.GeneratedAt, resp.GetGeneratedAt())
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/gid/...
```

Expected: FAIL（包不存在）。

- [ ] **Step 3: 写 pkg/xcodes/gid.go（域级错误码——gid 无自有码，透传）**

`pkg/xcodes/gid.go`：

```go
// Package xcodes hosts testkit-service's per-domain error codes.
//
// gid domain: gid RPCs (NextID / BatchNextID / Decompose) are 1:1 forwards over
// the embedded gid-service handler. They introduce no testkit-specific errors —
// request validation is enforced by protovalidate (count ∈ [1,1000], id >= 1)
// and downstream failures pass through as xerr (v2 §9). This file exists so the
// domain is represented in the per-domain xcodes layout; it declares no symbols.
package xcodes
```

> gid 域确无 testkit 自有错误码（protovalidate 拦非法入参、下游错透传）。诚实留包文档，不杜撰码。

- [ ] **Step 4: 写 gid.go（Service + Client 接口 + 三方法 + 转换器）**

`internal/service/gid/gid.go`：

```go
// Package gid implements testkit's gid debug domain: a 1:1 forward to the
// embedded gid-service. gid RPCs carry no caller-identity, so the testkit
// messages mirror gid.proto shape-for-shape and mapping is a plain field copy.
package gid

import (
	"context"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
)

// Client is the subset of the embedded gid handler this domain uses. The real
// *gidthirdcall.Handler (gid-service/pkg.Handler) satisfies it; tests use a stub.
type Client interface {
	NextID(ctx context.Context, req *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error)
	BatchNextID(ctx context.Context, req *gidv1.BatchNextIDRequest) (*gidv1.BatchNextIDResponse, error)
	Decompose(ctx context.Context, req *gidv1.DecomposeRequest) (*gidv1.DecomposeResponse, error)
}

// Service implements the gid debug domain.
type Service struct {
	client Client
}

// New constructs the gid service.
func New(client Client) *Service { return &Service{client: client} }

// NextID forwards to gid-service.
func (s *Service) NextID(ctx context.Context, req *testkitv1.NextIDRequest) (*testkitv1.NextIDResponse, error) {
	resp, err := s.client.NextID(ctx, toGIDNextIDRequest(req))
	if err != nil {
		return nil, err
	}
	return fromGIDNextIDResponse(resp), nil
}

// BatchNextID forwards to gid-service.
func (s *Service) BatchNextID(ctx context.Context, req *testkitv1.BatchNextIDRequest) (*testkitv1.BatchNextIDResponse, error) {
	resp, err := s.client.BatchNextID(ctx, toGIDBatchNextIDRequest(req))
	if err != nil {
		return nil, err
	}
	return fromGIDBatchNextIDResponse(resp), nil
}

// Decompose forwards to gid-service.
func (s *Service) Decompose(ctx context.Context, req *testkitv1.DecomposeRequest) (*testkitv1.DecomposeResponse, error) {
	resp, err := s.client.Decompose(ctx, toGIDDecomposeRequest(req))
	if err != nil {
		return nil, err
	}
	return fromGIDDecomposeResponse(resp), nil
}

// --- converters (testkit DTO ↔ gid-service proto); 1:1 shape ---

func toGIDNextIDRequest(_ *testkitv1.NextIDRequest) *gidv1.NextIDRequest {
	return &gidv1.NextIDRequest{}
}

func fromGIDNextIDResponse(r *gidv1.NextIDResponse) *testkitv1.NextIDResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.NextIDResponse{Id: r.GetId()}
}

func toGIDBatchNextIDRequest(r *testkitv1.BatchNextIDRequest) *gidv1.BatchNextIDRequest {
	return &gidv1.BatchNextIDRequest{Count: r.GetCount()}
}

func fromGIDBatchNextIDResponse(r *gidv1.BatchNextIDResponse) *testkitv1.BatchNextIDResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.BatchNextIDResponse{Ids: r.GetIds()}
}

func toGIDDecomposeRequest(r *testkitv1.DecomposeRequest) *gidv1.DecomposeRequest {
	return &gidv1.DecomposeRequest{Id: r.GetId()}
}

func fromGIDDecomposeResponse(r *gidv1.DecomposeResponse) *testkitv1.DecomposeResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.DecomposeResponse{
		Time:        r.GetTime(),
		Sequence:    r.GetSequence(),
		MachineId:   r.GetMachineId(),
		GeneratedAt: r.GetGeneratedAt(),
	}
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
go test ./internal/service/gid/...
```

Expected: PASS（3 个测试全绿）。

- [ ] **Step 6: Commit**

```bash
git add internal/service/gid/ pkg/xcodes/gid.go
git commit -m "feat(gid): 1:1 forward NextID/BatchNextID/Decompose to gid-service"
```

---

## Task 3: internal/service/dashboard 域（errgroup 聚合，TDD）

这是 spec §10 的「聚合型」范例：fail-fast 并发 fan-in + 自定义响应组装 + ctx 注入 Owner。

**Files:**
- Create: `internal/service/dashboard/dashboard.go`
- Create: `internal/service/dashboard/dashboard_test.go`
- Create: `pkg/xcodes/dashboard.go`

- [ ] **Step 1: 拉 errgroup 依赖**

```bash
cd /Users/moss/code/servekit/testkit-service
go get golang.org/x/sync
make tidy
```

Expected: `go.mod` 出现 `golang.org/x/sync x.x.x`。

- [ ] **Step 2: 写 dashboard 域测试（聚合 + Owner 注入 + fail-fast + 无 caller）**

`internal/service/dashboard/dashboard_test.go`：

```go
package dashboard_test

import (
	"context"
	"errors"
	"testing"

	"github.com/servekit/go-common/grpcx"
	messagev1 "github.com/servekit/message-service/gen/message/v1"
	storagev1 "github.com/servekit/storage-service/gen/storage/v1"
	userv1 "github.com/servekit/user-service/gen/user/v1"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/service/dashboard"
	"github.com/stretchr/testify/require"
)

// --- stubs implement dashboard.{User,Storage,Message}Client ---

type stubUser struct {
	total int64
	err   error
}

func (s *stubUser) ListUsersPaged(ctx context.Context, req *userv1.ListUsersPagedRequest) (*userv1.ListUsersPagedResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &userv1.ListUsersPagedResponse{Total: s.total}, nil
}

type stubStorage struct {
	quota         *storagev1.QuotaInfo
	receivedOwner *storagev1.Owner
	err           error
}

func (s *stubStorage) GetMyQuota(ctx context.Context, req *storagev1.GetMyQuotaRequest) (*storagev1.QuotaInfo, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.receivedOwner = req.GetOwner()
	return s.quota, nil
}

type stubMessage struct {
	email *messagev1.EmailStatsResponse
	sms   *messagev1.SMSStatsResponse
	err   error
}

func (s *stubMessage) GetEmailStats(ctx context.Context, req *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.email, nil
}

func (s *stubMessage) GetSMSStats(ctx context.Context, req *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.sms, nil
}

func ctxWithUser(id int64) context.Context {
	return context.WithValue(context.Background(), grpcx.UserIDKey, id)
}

func TestGetDashboard_AssemblesAllFour(t *testing.T) {
	svc := dashboard.New(
		&stubUser{total: 1234},
		&stubStorage{quota: &storagev1.QuotaInfo{TotalBytes: 1000, UsedBytes: 400, AvailableBytes: 600, FileCount: 9}},
		&stubMessage{
			email: &messagev1.EmailStatsResponse{
				Total: 50, Sent: 48, Failed: 2, SuccessRate: 96,
				Vendors: []*messagev1.EmailVendorStats{
					{Vendor: messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN, Total: 50, Sent: 48, Failed: 2},
				},
			},
			sms: &messagev1.SMSStatsResponse{Total: 10, Sent: 9, Failed: 1, SuccessRate: 90},
		},
	)

	resp, err := svc.GetDashboard(ctxWithUser(77), &testkitv1.GetDashboardRequest{})
	require.NoError(t, err)

	require.Equal(t, int64(50), resp.GetEmailStats().GetTotal())
	require.Equal(t, float64(96), resp.GetEmailStats().GetSuccessRate())
	require.Len(t, resp.GetEmailStats().GetVendors(), 1)
	require.Equal(t, testkitv1.EmailVendor_EMAIL_VENDOR_ALIYUN, resp.GetEmailStats().GetVendors()[0].GetVendor())
	require.Equal(t, int64(10), resp.GetSmsStats().GetTotal())
	require.Equal(t, int64(1000), resp.GetQuota().GetTotalBytes())
	require.Equal(t, int32(9), resp.GetQuota().GetFileCount())
	require.Equal(t, int64(1234), resp.GetUsers().GetTotal())
}

func TestGetDashboard_InjectsOwnerFromCtx(t *testing.T) {
	storage := &stubStorage{quota: &storagev1.QuotaInfo{}}
	svc := dashboard.New(
		&stubUser{total: 1},
		storage,
		&stubMessage{email: &messagev1.EmailStatsResponse{}, sms: &messagev1.SMSStatsResponse{}},
	)

	_, err := svc.GetDashboard(ctxWithUser(99), &testkitv1.GetDashboardRequest{})
	require.NoError(t, err)
	require.NotNil(t, storage.receivedOwner)
	require.Equal(t, storagev1.OwnerType_OWNER_TYPE_USER, storage.receivedOwner.GetOwnerType())
	require.Equal(t, int64(99), storage.receivedOwner.GetOwnerId())
}

func TestGetDashboard_FailFast_OnAnyUpstreamError(t *testing.T) {
	boom := errors.New("upstream down")
	svc := dashboard.New(
		&stubUser{err: boom},
		&stubStorage{quota: &storagev1.QuotaInfo{}},
		&stubMessage{email: &messagev1.EmailStatsResponse{}, sms: &messagev1.SMSStatsResponse{}},
	)

	_, err := svc.GetDashboard(ctxWithUser(1), &testkitv1.GetDashboardRequest{})
	require.ErrorIs(t, err, boom)
}

func TestGetDashboard_NoCallerID_ReturnsUnauthenticated(t *testing.T) {
	svc := dashboard.New(
		&stubUser{},
		&stubStorage{quota: &storagev1.QuotaInfo{}},
		&stubMessage{email: &messagev1.EmailStatsResponse{}, sms: &messagev1.SMSStatsResponse{}},
	)

	_, err := svc.GetDashboard(context.Background(), &testkitv1.GetDashboardRequest{})
	require.Error(t, err) // ErrCallerUnresolved — defensive; auth interceptor normally guarantees user_id
}
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
go test ./internal/service/dashboard/...
```

Expected: FAIL（包不存在）。

- [ ] **Step 4: 写 pkg/xcodes/dashboard.go**

`pkg/xcodes/dashboard.go`：

```go
package xcodes

import "github.com/servekit/go-common/xerr"

// ErrCallerUnresolved is returned when the dashboard cannot derive the caller's
// user_id from ctx (the auth interceptor normally guarantees it for protected
// RPCs; this is a defensive guard before injecting the storage Owner).
var ErrCallerUnresolved = xerr.New(
	"caller_unresolved",
	xerr.CategoryUnauthenticated,
	401,
	"caller identity could not be resolved from session",
)
```

> `xerr.New(reason, category, httpCode, message)` 签名与 P1 Task 11 的 `auth.ErrSessionInvalid` 一致；`xerr.CategoryUnauthenticated` 常量按 `go-common/xerr` 实际定义（实现时核对，与 P1 保持一致）。

- [ ] **Step 5: 写 dashboard.go（Service + 三 Client 接口 + errgroup 聚合 + 转换器）**

`internal/service/dashboard/dashboard.go`：

```go
// Package dashboard implements testkit's global dashboard: a fail-fast
// concurrent fan-in over the message/storage/user domains that assembles a
// single aggregated snapshot. It is the spec §10 "聚合型" reference example.
package dashboard

import (
	"context"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/xerr"
	"golang.org/x/sync/errgroup"

	messagev1 "github.com/servekit/message-service/gen/message/v1"
	storagev1 "github.com/servekit/storage-service/gen/storage/v1"
	userv1 "github.com/servekit/user-service/gen/user/v1"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/pkg/xcodes"
)

// UserClient is the subset of the embedded user handler dashboard uses.
type UserClient interface {
	ListUsersPaged(ctx context.Context, req *userv1.ListUsersPagedRequest) (*userv1.ListUsersPagedResponse, error)
}

// StorageClient is the subset of the embedded storage handler dashboard uses.
type StorageClient interface {
	GetMyQuota(ctx context.Context, req *storagev1.GetMyQuotaRequest) (*storagev1.QuotaInfo, error)
}

// MessageClient is the subset of the embedded message handler dashboard uses.
type MessageClient interface {
	GetEmailStats(ctx context.Context, req *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error)
	GetSMSStats(ctx context.Context, req *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error)
}

// Service implements the dashboard aggregation domain.
type Service struct {
	user    UserClient
	storage StorageClient
	message MessageClient
}

// New constructs the dashboard service. The three clients are the embedded
// downstream handlers (satisfy the narrow interfaces above structurally).
func New(user UserClient, storage StorageClient, message MessageClient) *Service {
	return &Service{user: user, storage: storage, message: message}
}

// GetDashboard fans out to message/storage/user concurrently (fail-fast via
// errgroup.WithContext — first error wins, peer calls are canceled) and
// assembles the aggregated response. The caller's Owner for GetMyQuota is
// injected from ctx (v2 §3.2 rule 1); it is never present in the request.
func (s *Service) GetDashboard(ctx context.Context, req *testkitv1.GetDashboardRequest) (*testkitv1.DashboardResponse, error) {
	userID, err := grpcx.GetUserIDFromCtx(ctx)
	if err != nil {
		return nil, xcodes.ErrCallerUnresolved.New()
	}

	var (
		emailStats *messagev1.EmailStatsResponse
		smsStats   *messagev1.SMSStatsResponse
		quota      *storagev1.QuotaInfo
		users      *userv1.ListUsersPagedResponse
	)

	// errgroup.WithContext cancels peer calls on first error → fail-fast.
	// Each Go closure assigns its result into the shared vars above; the
	// derived gctx is respected so a failing peer propagates cancellation.
	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() (e error) {
		emailStats, e = s.message.GetEmailStats(gctx, &messagev1.GetEmailStatsRequest{})
		return e
	})
	g.Go(func() (e error) {
		smsStats, e = s.message.GetSMSStats(gctx, &messagev1.GetSMSStatsRequest{})
		return e
	})
	g.Go(func() (e error) {
		quota, e = s.storage.GetMyQuota(gctx, &storagev1.GetMyQuotaRequest{
			Owner: &storagev1.Owner{
				OwnerType: storagev1.OwnerType_OWNER_TYPE_USER,
				OwnerId:   userID,
			},
		})
		return e
	})
	g.Go(func() (e error) {
		// count=true with page_size=1 fetches just the total (we only need the
		// user count for the dashboard summary, not any user rows).
		users, e = s.user.ListUsersPaged(gctx, &userv1.ListUsersPagedRequest{Page: 1, PageSize: 1, Count: true})
		return e
	})

	if err := g.Wait(); err != nil {
		return nil, err // xerr passthrough (v2 §9) — surfaces first upstream failure
	}

	return &testkitv1.DashboardResponse{
		EmailStats: emailStatsFromMessage(emailStats),
		SmsStats:   smsStatsFromMessage(smsStats),
		Quota:      quotaFromStorage(quota),
		Users:      usersSummaryFromUser(users),
	}, nil
}

// --- converters (testkit DTO ← downstream proto) ---

func emailStatsFromMessage(r *messagev1.EmailStatsResponse) *testkitv1.EmailStats {
	if r == nil {
		return nil
	}
	vendors := make([]*testkitv1.EmailVendorStats, 0, len(r.GetVendors()))
	for _, v := range r.GetVendors() {
		vendors = append(vendors, &testkitv1.EmailVendorStats{
			Vendor: testkitv1.EmailVendor(v.GetVendor()), // int cast — enums mirror message.proto
			Total:  v.GetTotal(),
			Sent:   v.GetSent(),
			Failed: v.GetFailed(),
		})
	}
	return &testkitv1.EmailStats{
		Total:       r.GetTotal(),
		Sent:        r.GetSent(),
		Failed:      r.GetFailed(),
		SuccessRate: r.GetSuccessRate(),
		Vendors:     vendors,
	}
}

func smsStatsFromMessage(r *messagev1.SMSStatsResponse) *testkitv1.SMSStats {
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
	return &testkitv1.SMSStats{
		Total:       r.GetTotal(),
		Sent:        r.GetSent(),
		Failed:      r.GetFailed(),
		SuccessRate: r.GetSuccessRate(),
		Vendors:     vendors,
	}
}

func quotaFromStorage(q *storagev1.QuotaInfo) *testkitv1.MyQuota {
	if q == nil {
		return nil
	}
	return &testkitv1.MyQuota{
		TotalBytes:     q.GetTotalBytes(),
		UsedBytes:      q.GetUsedBytes(),
		AvailableBytes: q.GetAvailableBytes(),
		FileCount:      q.GetFileCount(),
	}
}

func usersSummaryFromUser(r *userv1.ListUsersPagedResponse) *testkitv1.UsersSummary {
	if r == nil {
		return nil
	}
	return &testkitv1.UsersSummary{Total: r.GetTotal()}
}

// _ keeps xerr imported if future guards add wrapping; ErrCallerUnresolved
// construction above is the sole current use via xcodes (which imports xerr).
var _ = xerr.New
```

> 末尾 `var _ = xerr.New` 仅在 dashboard.go 本文件不直接用 `xerr`（只用 `xcodes.ErrCallerUnresolved`）时避免 unused-import；若 linter 仍报，则直接从 import 列表删 `go-common/xerr`（因 `xcodes` 已封装该错误码）。实现时按编译器提示二选一——默认推荐**删除该 import 与 `var _` 行**（让 xerr 只活在 `pkg/xcodes`）。

- [ ] **Step 6: 运行测试，确认通过**

```bash
go test ./internal/service/dashboard/...
```

Expected: PASS（4 个测试全绿：聚合组装、Owner 注入、fail-fast、无 caller）。

- [ ] **Step 7: Commit**

```bash
git add internal/service/dashboard/ pkg/xcodes/dashboard.go go.mod go.sum
git commit -m "feat(dashboard): fail-fast errgroup aggregation over message/storage/user"
```

---

## Task 4: service.go + handler 接线

把 gid/dashboard 两个域挂到 `Service`，handler 加 4 个一行委托。

**Files:**
- Modify: `internal/service/service.go`
- Modify: `pkg/handler/testkit.go`

- [ ] **Step 1: service.go 加域包 import（别名避开 thirdcall 冲突）**

在 `internal/service/service.go` 的 import 段加两行（注意别名，见关键决策 #5）：

```go
import (
	// ... existing imports ...
	gidsvc "github.com/servekit/testkit-service/internal/service/gid"
	dashboardsvc "github.com/servekit/testkit-service/internal/service/dashboard"
)
```

> P1 Task 8 已 import `internal/thirdcall/gid` 为 `gid`（以及 `user`/`storage`/`message`），故域包必须别名。

- [ ] **Step 2: Service struct 加两个字段**

```go
type Service struct {
	// ... existing fields (cfg, mgr, db, redis, user/storage/message/gid
	//     *xxx.Handler, plus P1–P4 domain sub-services like auth/user/...) ...

	gidSvc      *gidsvc.Service
	dashboardSvc *dashboardsvc.Service
}
```

- [ ] **Step 3: 在 New/resolveDownstreams（四个 *xxx.Handler 都建成后）构造两个域服务 + facade**

在四个下游 handler（`s.gid`/`s.user`/`s.storage`/`s.message`，P1 Task 8 已建）构造完成之后追加：

```go
	// P5 domain services wrap the already-built downstream handlers.
	s.gidSvc = gidsvc.New(s.gid)
	s.dashboardSvc = dashboardsvc.New(s.user, s.storage, s.message)
```

并在文件底部 accessors 区追加两个 facade：

```go
// Gid exposes the gid debug domain service.
func (s *Service) Gid() *gidsvc.Service { return s.gidSvc }

// Dashboard exposes the dashboard aggregation domain service.
func (s *Service) Dashboard() *dashboardsvc.Service { return s.dashboardSvc }
```

> 三个下游 handler 字段名以 P1 Task 8 实际命名为准（`s.user`/`s.storage`/`s.message`/`s.gid`）；若 P2–P4 改名（如 `s.userHdl`），相应调整。`*user.Handler`/`*storage.Handler`/`*message.Handler` 结构式满足 `dashboard.UserClient`/`StorageClient`/`MessageClient`；`*gid.Handler` 满足 `gid.Client`——Go 结构式类型自动校验，无需显式 implements。

- [ ] **Step 4: handler 加 4 个一行委托**

在 `pkg/handler/testkit.go` 追加（与 P1 Task 14 的 auth 委托同风格）：

```go
// --- P5: gid debug ---

func (h *Handler) NextID(ctx context.Context, req *testkitv1.NextIDRequest) (*testkitv1.NextIDResponse, error) {
	return h.svc.Gid().NextID(ctx, req)
}

func (h *Handler) BatchNextID(ctx context.Context, req *testkitv1.BatchNextIDRequest) (*testkitv1.BatchNextIDResponse, error) {
	return h.svc.Gid().BatchNextID(ctx, req)
}

func (h *Handler) Decompose(ctx context.Context, req *testkitv1.DecomposeRequest) (*testkitv1.DecomposeResponse, error) {
	return h.svc.Gid().Decompose(ctx, req)
}

// --- P5: dashboard ---

func (h *Handler) GetDashboard(ctx context.Context, req *testkitv1.GetDashboardRequest) (*testkitv1.DashboardResponse, error) {
	return h.svc.Dashboard().GetDashboard(ctx, req)
}
```

- [ ] **Step 5: 构建并跑全部测试**

```bash
go build ./...
go test ./...
```

Expected: 全绿（Task 1 Step 4 的 FAIL 至此转 PASS——Handler 现已实现新接口方法）。

- [ ] **Step 6: 本地起服务 + curl 验证 gid/dashboard（需 PG/Redis/下游就绪）**

```bash
make run
# 另一终端：
curl -s http://localhost:18085/api/v1/gid/next        # 需带 Bearer token（鉴权 RPC）
curl -s http://localhost:18085/api/v1/dashboard        # 需带 Bearer token
```

Expected: gid/next 返回 `{"id":"..."}`；dashboard 返回聚合 JSON（email_stats/sms_stats/quota/users）。无 token → 401。

- [ ] **Step 7: Commit**

```bash
git add internal/service/service.go pkg/handler/testkit.go
git commit -m "feat(handler): wire gid debug + dashboard RPCs through service facades"
```

---

## Task 5: 前端 openapi 重生 + 路由

后端 proto 已扩，前端按 v2 Delta C 重生 services，并加两页路由。

**Files:**
- Modify: `web/config/routes.ts`
- Regenerate: `web/src/services/testkit/`（生成产物，不手改）

- [ ] **Step 1: 重生前端 services/类型**

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm run openapi
```

Expected: `src/services/testkit/` 下新增 gid/dashboard 请求函数与 `typings.d.ts` 类型（`NextIDResponse`、`DecomposeResponse`、`DashboardResponse`、`EmailStats` 等）。生成物不手改。

> 生成函数名按 operationId（`simple_operation_ids=true` → `NextID`/`BatchNextID`/`Decompose`/`GetDashboard`），`@umijs/openapi` 通常首字母小写化为 `nextID`/`batchNextID`/`decompose`/`getDashboard`。以实际产物 import 为准（P1 Task 17 同此约定）。

- [ ] **Step 2: 加路由**

在 `web/config/routes.ts` 的菜单数组里加两条（与现有 P1–P4 路由同级；图标按项目 `iconMap` 调整）：

```ts
{
  path: '/dashboard',
  name: '仪表盘',
  icon: 'dashboard',
  component: './Dashboard',
  access: 'canInternal', // 内部后台管理（聚合全局统计）；后端不做鉴权（v2 §3.5）
},
{
  path: '/gid',
  name: 'GID 调试',
  icon: 'tool',
  component: './Gid/Debug',
  access: 'canInternal', // 调试工具，内部账号可见
},
```

> P1 Task 17 已定登录后按 UserType 落地：INTERNAL → `/dashboard`（故仪表盘即内部账号首页），NORMAL → `/profile`。gid 调试 + 仪表盘均属内部，统一 `access: 'canInternal'`。

- [ ] **Step 3: Commit**

```bash
git add web/config/routes.ts web/src/services/testkit/
git commit -m "feat(web): regenerate services + add dashboard/gid routes"
```

---

## Task 6: gid 调试页

三块卡片：生成单个 / 批量生成 / 解析 ID。全部用生成的 service，**不手写 fetch**（v2 Delta C）。

**Files:**
- Create: `web/src/pages/Gid/Debug/index.tsx`

- [ ] **Step 1: 写 gid 调试页**

`web/src/pages/Gid/Debug/index.tsx`：

```tsx
import { Button, Card, Descriptions, InputNumber, Space, Typography, message } from 'antd';
import { useState } from 'react';
import { batchNextID, decompose, nextID } from '@/services/testkit';

const { Paragraph, Text } = Typography;

// NOTE: snowflake IDs are 63-bit and exceed JS Number.MAX_SAFE_INTEGER (2^53).
// The openapi codegen currently maps int64 → number, so very large IDs may lose
// precision in the UI. This is a cross-cutting concern (affects P1–P4 too) and
// is left for a separate int64→string codegen pass; the debug page accepts the
// risk for now.
export default function GidDebugPage() {
  const [single, setSingle] = useState<number | null>(null);
  const [batchCount, setBatchCount] = useState<number>(10);
  const [batchIds, setBatchIds] = useState<number[]>([]);
  const [decomposeId, setDecomposeId] = useState<number | null>(null);
  const [decomposed, setDecomposed] = useState<{
    time: string;
    sequence: string;
    machine_id: string;
    generated_at: string;
  } | null>(null);

  const genSingle = async () => {
    try {
      const r = await nextID();
      setSingle(r.id);
      message.success('已生成');
    } catch {
      /* request 拦截器已处理错误提示与 401 跳转 */
    }
  };

  const genBatch = async () => {
    try {
      const r = await batchNextID({ count: batchCount });
      setBatchIds(r.ids ?? []);
      message.success(`已生成 ${r.ids?.length ?? 0} 个`);
    } catch {
      /* noop */
    }
  };

  const doDecompose = async () => {
    if (decomposeId == null) return;
    try {
      const r = await decompose({ id: decomposeId });
      setDecomposed(r);
    } catch {
      /* noop */
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="生成单个 ID">
        <Button type="primary" onClick={genSingle}>
          生成 ID
        </Button>
        {single != null && (
          <Paragraph style={{ marginTop: 16 }}>
            <Text copyable code>
              {single}
            </Text>
          </Paragraph>
        )}
      </Card>

      <Card title="批量生成 ID">
        <Space>
          <InputNumber min={1} max={1000} value={batchCount} onChange={(v) => setBatchCount(v ?? 1)} />
          <Button type="primary" onClick={genBatch}>
            批量生成
          </Button>
        </Space>
        {batchIds.length > 0 && (
          <Paragraph style={{ marginTop: 16 }}>
            <Text copyable>{batchIds.join(', ')}</Text>
          </Paragraph>
        )}
      </Card>

      <Card title="解析 ID">
        <Space>
          <InputNumber
            style={{ width: 320 }}
            value={decomposeId ?? undefined}
            onChange={(v) => setDecomposeId(v ?? null)}
            placeholder="输入要解析的 ID"
          />
          <Button type="primary" onClick={doDecompose}>
            解析
          </Button>
        </Space>
        {decomposed && (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="时间（Unix 毫秒）">{decomposed.time}</Descriptions.Item>
            <Descriptions.Item label="序列号">{decomposed.sequence}</Descriptions.Item>
            <Descriptions.Item label="机器 ID">{decomposed.machine_id}</Descriptions.Item>
            <Descriptions.Item label="生成时间">{decomposed.generated_at}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </Space>
  );
}
```

> decompose 的 path-param 调用形状（`decompose({ id })` vs `decompose(id)`）以 `npm run openapi` 实际生成为准；`@umijs/openapi` 对 GET `/api/v1/gid/decompose/{id}` 通常生成对象入参。若生成的是 positional 参数，改为 `await decompose(decomposeId)`。

- [ ] **Step 2: 前端类型检查**

```bash
cd /Users/moss/code/servekit/testkit-service/web
npx tsc --noEmit
```

Expected: 无错误（生成类型已包含 NextID/BatchNextID/Decompose 相关声明）。

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Gid/
git commit -m "feat(web): gid debug page (single/batch/decompose)"
```

---

## Task 7: 仪表盘页（KPI tiles + 图表）

KPI 用 antd `Statistic`/`Progress`；供应商分布用 `@ant-design/charts` 的 Pie（spec §5 要求 charts）。

**Files:**
- Create: `web/src/pages/Dashboard/index.tsx`

- [ ] **Step 1: 装 antd6 兼容的 charts 版本**

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm i @ant-design/charts@^2
```

> `@ant-design/charts` v2 线支持 React 19 + antd 6（与 Pro v6 栈匹配）。若 lockfile 解析冲突，按 npm 报错提示对齐 peer 范围。

- [ ] **Step 2: 写仪表盘页**

`web/src/pages/Dashboard/index.tsx`：

```tsx
import { Card, Col, Progress, Row, Spin, Statistic } from 'antd';
import { Pie } from '@ant-design/charts';
import { useEffect, useState } from 'react';
import { getDashboard } from '@/services/testkit';

const EmailVendorLabel: Record<string, string> = {
  EMAIL_VENDOR_UNSPECIFIED: '未知',
  EMAIL_VENDOR_ALIYUN: '阿里云',
  EMAIL_VENDOR_TENCENT: '腾讯云',
  EMAIL_VENDOR_NETEASE: '网易',
};

const SmsVendorLabel: Record<string, string> = {
  SMS_VENDOR_UNSPECIFIED: '未知',
  SMS_VENDOR_ALIYUN: '阿里云',
  SMS_VENDOR_TENCENT: '腾讯云',
  SMS_VENDOR_VOLCENGINE: '火山引擎',
  SMS_VENDOR_BYTEPLUS: 'BytePlus',
  SMS_VENDOR_HUAWEI: '华为云',
};

interface DashboardData {
  email_stats?: {
    total?: number;
    sent?: number;
    failed?: number;
    success_rate?: number;
    vendors?: { vendor: string; total: number; sent: number; failed: number }[];
  };
  sms_stats?: {
    total?: number;
    sent?: number;
    failed?: number;
    success_rate?: number;
    vendors?: { vendor: string; total: number; sent: number; failed: number }[];
  };
  quota?: { total_bytes?: number; used_bytes?: number; available_bytes?: number; file_count?: number };
  users?: { total?: number };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await getDashboard());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spin />;
  if (!data) return null;

  const email = data.email_stats ?? {};
  const sms = data.sms_stats ?? {};
  const quota = data.quota ?? {};
  const users = data.users ?? {};

  const emailVendors = (email.vendors ?? []).map((v) => ({
    vendor: EmailVendorLabel[v.vendor] ?? v.vendor,
    count: v.total,
  }));
  const smsVendors = (sms.vendors ?? []).map((v) => ({
    vendor: SmsVendorLabel[v.vendor] ?? v.vendor,
    count: v.total,
  }));
  const quotaPct =
    quota.total_bytes && quota.total_bytes > 0
      ? Math.round(((quota.used_bytes ?? 0) / quota.total_bytes) * 100)
      : 0;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="邮件总数" value={email.total ?? 0} />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="邮件成功率" value={email.success_rate ?? 0} suffix="%" />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="短信总数" value={sms.total ?? 0} />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="短信成功率" value={sms.success_rate ?? 0} suffix="%" />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="用户总数" value={users.total ?? 0} />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="文件数" value={quota.file_count ?? 0} />
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card title="存储配额">
          <Progress percent={quotaPct} status={quotaPct >= 90 ? 'exception' : 'normal'} />
          <Statistic
            title="已用 / 总量（字节）"
            value={quota.used_bytes ?? 0}
            suffix={`/ ${quota.total_bytes ?? 0}`}
          />
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card title="邮件供应商分布">
          {emailVendors.length ? (
            <Pie data={emailVendors} angleField="count" colorField="vendor" radius={0.8} />
          ) : (
            '暂无数据'
          )}
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card title="短信供应商分布">
          {smsVendors.length ? (
            <Pie data={smsVendors} angleField="count" colorField="vendor" radius={0.8} />
          ) : (
            '暂无数据'
          )}
        </Card>
      </Col>
    </Row>
  );
}
```

- [ ] **Step 3: 前端类型检查**

```bash
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Dashboard/ web/package.json web/package-lock.json
git commit -m "feat(web): global dashboard with KPI tiles + vendor Pie charts"
```

---

## 验收检查（P5 完成时跑）

- [ ] `go build ./...` 通过
- [ ] `golangci-lint run ./...` 无 error
- [ ] `make proto && git diff --exit-code`（生成一致）
- [ ] testkit.proto **不 import 任何下游 proto**（`grep -n '^import' api/proto/testkit/v1/testkit.proto` 仅命中 google/buf 标准件）
- [ ] `go test -race -coverprofile=coverage.out ./...` 全绿（含 gid 3 + dashboard 4 新测试）
- [ ] dashboard 域是 testkit 里唯一 import message/storage/user gen 的地方；gid 域是唯一 import gid gen 的地方（`grep -rn "message-service/gen\|storage-service/gen\|user-service/gen" internal/service/ | grep -v _test` 命中仅在 `internal/service/dashboard/`；`grep -rn "gid-service/gen" internal/service/ | grep -v _test` 命中仅在 `internal/service/gid/`）
- [ ] 前端 `npm run openapi` 生成 gid/dashboard services；两页用生成 service、**无手写 fetch**
- [ ] `docker compose up --build -d` 全栈起来；登录后访问 `/dashboard`（聚合数据 + 图表）、`/gid`（生成/解析 ID）端到端通
- [ ] dashboard 在下游异常时 fail-fast（例如停掉 message-service，GetDashboard 返回该下游的 xerr，而非半空 200）

---

## Self-Review

**1. Spec 覆盖（逐条对 spec §7 P5 行 + §3/§10）**
- gid 三 RPC（NextID/BatchNextID/Decompose）→ Task 1 proto + Task 2 域 + Task 4 接线。✅
- GetDashboard 聚合（GetEmailStats + GetSMSStats + GetMyQuota + ListUsersPaged）→ Task 1 proto + Task 3 域 + Task 4 接线。✅
- 自包含 proto、不 import 下游 → Task 1 Step 5 grep 校验；映射层是唯一 import 下游 gen 处 → 验收检查。✅
- 「调用方身份」字段下沉（GetMyQuota 的 Owner 由 ctx 注入）→ Task 3 Step 5 实现 + `TestGetDashboard_InjectsOwnerFromCtx`。✅
- 枚举在 testkit proto 重新定义（EmailVendor/SmsVendor 镜像）→ Task 1 Step 1，映射整型直转 → Task 3 Step 5。✅（含 P4 复用兜底）
- xerr 透传 → Task 3 fail-fast `return nil, err`；验收 fail-fast 场景。✅
- 前端 swagger codegen、不手写请求 → Task 5/6/7 全用 `@/services/testkit`。✅
- 前端 charts via `@ant-design/charts` → Task 7 Pie。✅
- 覆盖度：spec §7 P5 行「3 + 1 聚合」全部落地，无遗漏。

**2. Placeholder 扫描**
- 无 TBD/TODO/「稍后实现」。gid xcodes 文件为包文档（已说明为何无码——诚实，非占位）。
- 所有代码步骤含完整可编译代码；命令含 expected 输出。
- 唯一「以实际生成为准」处：前端 openapi 生成函数名/path-param 调用形状（P1 Task 17 已确立的同款处理，非占位——是 codegen 产物的客观不确定性，给了主选 + 备选）。

**3. 类型一致性**
- proto 字段名 ↔ Go gen getter：`id`→`Id`、`machine_id`→`MachineId`、`generated_at`→`GeneratedAt`、`success_rate`→`SuccessRate`、`total_bytes`→`TotalBytes`、`owner_type`→`OwnerType`、`owner_id`→`OwnerId`——均与 proto 惯例一致。
- 域 Client 接口方法签名与下游 handler 一致（gid 三方法、message GetEmailStats/GetSMSStats、storage GetMyQuota、user ListUsersPaged——均已从真实 proto/Handler 核实）。
- enum 数值与 message.proto 逐字核对（EmailVendor 0..3、SmsVendor 0..5），整型直转合法。
- facade 方法名 `Gid()`/`Dashboard()` 在 service.go（Task 4 Step 3）与 handler（Task 4 Step 4）一致。
- 关键决策 #5 的 import 别名 `gidsvc`/`dashboardsvc` 在 Task 4 三处（import/字段/facade）统一。

---

## 关联

**设计文档：**
- `docs/superpowers/specs/2026-07-29-testkit-service-design.md`（v2，§3 自包含 proto+映射层、§7 P5 行、§10 聚合型范例、§9 xerr 透传）

**前置 plan（GOLDEN TEMPLATE，本计划匹配其风格）：**
- `docs/superpowers/plans/2026-07-28-testkit-service-p1-foundation.md`（Task 5 thirdcall、Task 6 gid/message adapter、Task 8 service.go、Task 12 proto+enum、Task 13 域+映射+测试、Task 14 handler+facade）

**下游 proto（已核实，作为映射依据）：**
- `gid-service/api/proto/gid/v1/gid.proto`（4 RPC，三调试 RPC 1:1 镜像源）
- `message-service/api/proto/message/v1/message.proto`（GetEmailStats/GetSMSStats + EmailVendor/SmsVendor enum 数值源）
- `storage-service/api/proto/storage/v1/storage.proto`（GetMyQuota + Owner/OwnerType + QuotaInfo）
- `user-service/api/proto/user/v1/user.proto`（ListUsersPaged + ListUsersPagedResponse.total）

**遵循 skill：**
- `golang-service-development`（架构 / 映射层 / handler+facade）
- `proto-development`（proto 写法 / protovalidate）
- `golang-development`（Go 风格 / lint）
