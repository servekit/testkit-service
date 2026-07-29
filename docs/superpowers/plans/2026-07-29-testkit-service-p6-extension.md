# testkit-service P6（扩展：挂载新服务）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 验证 testkit-service 的可扩展性——以挂载一个全新的 `payment-service` 为例，给出可复用的「加一个下游服务」配方，不动地基、不碰既有域。

**Architecture:** 新服务按既有 four-step 配方挂入：(1) thirdcall 双层（pkg/thirdcall + internal/thirdcall，默认 mode=module）；(2) 配置 + option + service.go 装配 +（若有表）migrate；(3) 自包含 testkit proto message + `internal/service/<name>/` 映射层；(4) 前端菜单 + 页面 + `npm run openapi` 重生。全程沿用 v2 §3 自包含 proto + 映射层、§4 swagger、§5 前端 codegen 约定。

**Tech Stack:** Go 1.26 + go-common（grpcx/lifecycle/configx/dbx）；buf v2 + grpc-gateway + openapiv2；Ant Design Pro v6（Umi Max 4）。

---

## 前置说明

- 本计划是**配方**：以假设的 `payment-service`（gRPC + grpc-gateway，go-common 栈，package `payment.v1`，暴露 `CreatePayment`/`GetPayment`/`ListMyPayments` 等）为样板。真实服务接入时把 `payment` / `Payment` / `paymentv1` 全局替换即可。
- **不触碰**既有 proto 域（auth/user/storage/message/gid/dashboard）的业务代码——只在 `service.go` / `config.go` / `option.go` / `migrate.go` 追加装配行，在 `testkit.proto` 追加 payment 域 RPC+message。
- 依赖边界（v2 §3.4）：`paymentv1`（下游 gen）只被 `internal/thirdcall/payment/`（client 接线）+ `internal/service/payment/`（映射）import。
- payment-service 必须已在 `go.mod` require（`go get github.com/servekit/payment-service@latest`），且暴露 `pkg.NewModule` / `pkg.NewClient` /（若有表）`pkg.Migrate`（与现有四服务一致）。

---

## File Structure（本计划涉及）

```
testkit-service/
├── api/proto/testkit/v1/testkit.proto      # 追加 payment 域 RPC+message+enum [改]
├── cmd/server/migrate.go                    # 若 payment 有表，追加 paymentpkg.Migrate [改]
├── internal/
│   ├── thirdcall/payment/{module.go,grpc.go} # in-process / grpc 双实现 [建]
│   └── service/payment/payment.go           # 映射层（testkit↔paymentv1）[建]
│   └── service/payment/payment_test.go      # [建]
├── pkg/
│   ├── thirdcall/payment.go                 # 接口 + 工厂（mode=module/grpc）[建]
│   ├── option/option.go                     # WithPayment() [改]
│   ├── config/config.go                     # ThirdPartyConfig.Payment [改]
│   ├── handler/testkit.go                   # payment RPC 薄壳委托 [改]
│   └── xcodes/payment.go                    # [建]
├── internal/service/service.go              # payment *payment.Service + New 装配 + Payment() facade [改]
├── config.example.yaml                      # third_party.payment 段 [改]
├── .env.example                             # TESTKIT_THIRD_PARTY_PAYMENT_* [改]
└── web/
    ├── config/routes.ts                     # 侧边栏「支付」菜单 [改]
    └── src/pages/Payment/                   # 支付页面（用生成 service）[建]
```

---

## Task 1: thirdcall 双层（pkg/thirdcall + internal/thirdcall）

**Files:**
- Create: `pkg/thirdcall/payment.go`
- Create: `internal/thirdcall/payment/module.go`
- Create: `internal/thirdcall/payment/grpc.go`

照搬 P1 Task 5 的 thirdcall 双层样板（user/storage/message/gid 之一），把名字改成 payment、下游 client 类型改成 `paymentv1.PaymentServiceClient`。

- [ ] **Step 1: pkg/thirdcall/payment.go（接口 + 工厂）**

```go
// Package thirdcall defines the payment downstream interface + dual-mode factory.
package thirdcall

import (
    "context"

    paymentv1 "github.com/servekit/payment-service/gen/payment/v1"
    paymentpkg "github.com/servekit/payment-service/pkg"
)

// PaymentClient is the subset of payment-service testkit uses (typed in paymentv1).
type PaymentClient interface {
    CreatePayment(ctx context.Context, req *paymentv1.CreatePaymentRequest) (*paymentv1.Payment, error)
    GetPayment(ctx context.Context, req *paymentv1.GetPaymentRequest) (*paymentv1.Payment, error)
    ListMyPayments(ctx context.Context, req *paymentv1.ListMyPaymentsRequest) (*paymentv1.ListMyPaymentsResponse, error)
    // ...按真实 payment-service RPC 补齐 testkit 需要的子集
}

// NewPayment returns a module (in-process) or grpc client per cfg.Mode.
func NewPayment(cfg *paymentpkg.Config) (PaymentClient, func(), error) {
    switch cfg.Mode {
    case "grpc":
        return newPaymentGRPC(cfg)
    case "module", "":
        return newPaymentModule(cfg)
    default:
        return nil, nil, fmt.Errorf("thirdcall payment: unknown mode %q", cfg.Mode)
    }
}
```

> 注：`fmt` 已在包内 import（与既有 thirdcall 文件一致）；工厂签名/错误风格照抄 `pkg/thirdcall/user.go`。`paymentpkg.Config` 的 `Mode`/`Target` 字段沿用 user-service 的 `RemoteServiceConfig` 形状（见 P1 Task 3）。

- [ ] **Step 2: internal/thirdcall/payment/module.go（in-process embed）**

```go
package payment

import (
    paymentv1 "github.com/servekit/payment-service/gen/payment/v1"
    paymentpkg "github.com/servekit/payment-service/pkg"
)

type module struct {
    cli paymentv1.PaymentServiceClient
}

func newPaymentModule(cfg *paymentpkg.Config) (*module, func(), error) {
    handler, cleanup, err := paymentpkg.NewModule(cfg) // 返回 *handler.Handler + cleanup
    if err != nil {
        return nil, nil, err
    }
    return &module{cli: paymentpkg.NewClient(handler)}, cleanup, nil
}

// 实现包外 PaymentClient 接口的方法：直接转发到 cli（paymentv1 类型透传）。
func (m *module) CreatePayment(ctx context.Context, req *paymentv1.CreatePaymentRequest) (*paymentv1.Payment, error) {
    return m.cli.CreatePayment(ctx, req)
}
// ...GetPayment / ListMyPayments 同形
```

> 注：`paymentpkg.NewModule` / `NewClient` 的真实签名以 payment-service/pkg 为准（照 user-service/pkg 抄）。若 payment-service 无 DB，`NewModule` 不需 db/redis 注入；若有，见 Task 4 共享连接注入。

- [ ] **Step 3: internal/thirdcall/payment/grpc.go（独立部署 grpc 模式）**

```go
package payment

import (
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"

    paymentv1 "github.com/servekit/payment-service/gen/payment/v1"
    paymentpkg "github.com/servekit/payment-service/pkg"
)

type grpcClient struct{ cli paymentv1.PaymentServiceClient }

func newPaymentGRPC(cfg *paymentpkg.Config) (*grpcClient, func(), error) {
    conn, err := grpc.NewClient(cfg.Target, grpc.WithTransportCredentials(insecure.NewCredentials()))
    if err != nil {
        return nil, nil, err
    }
    return &grpcClient{cli: paymentv1.NewPaymentServiceClient(conn)}, func() { _ = conn.Close() }, nil
}

func (g *grpcClient) CreatePayment(ctx context.Context, req *paymentv1.CreatePaymentRequest) (*paymentv1.Payment, error) {
    return g.cli.CreatePayment(ctx, req)
}
// ...GetPayment / ListMyPayments 同形
```

- [ ] **Step 4: 验证编译**

```bash
go build ./...
```

Expected: PASS（payment-service 已在 go.mod require；接口/实现齐备）。

- [ ] **Step 5: Commit**

```bash
git add pkg/thirdcall/payment.go internal/thirdcall/payment/
git commit -m "feat(thirdcall): add payment downstream (dual-mode)"
```

---

## Task 2: 配置 + option + service.go 装配

**Files:**
- Modify: `pkg/config/config.go`
- Modify: `pkg/option/option.go`
- Modify: `internal/service/service.go`
- Modify: `config.example.yaml`
- Modify: `.env.example`

照搬 P1 Task 3（config）/ Task 7（option）/ Task 8（service.go）的 payment 段。

- [ ] **Step 1: config.go 加 Payment 字段**

```go
// in ThirdPartyConfig
Payment *RemoteServiceConfig[*paymentpkg.Config]
```

`config.example.yaml` 加：

```yaml
third_party:
  payment:
    mode: module          # module(in-process) | grpc
    target: ""            # grpc 模式才填，如 localhost:19098
    config:
      # payment-service 自身配置结构 + ${VAR} 占位
```

`.env.example` 加 payment 需要的 env（按 payment-service 的 .env.example 抄，前缀 `TESTKIT_THIRD_PARTY_PAYMENT_`）。

- [ ] **Step 2: option.go 加 WithPayment**

```go
// in option.go
func WithPayment(c thirdcall.PaymentClient) Option {
    return func(o *Options) { o.Payment = c }
}
```

- [ ] **Step 3: service.go 构造 payment client + 注入 payment.Service**

```go
// in resolve 序列（照 user/storage/message 的 resolve 形状）
paymentCli, paymentCleanup, err := thirdcall.NewPayment(cfg.ThirdParty.Payment.Config)
if err != nil { return nil, fmt.Errorf("resolve payment: %w", err) }
o.AddCleanup(paymentCleanup)

// 构造 payment 域服务（映射层）
s.payment = payment.New(paymentCli)

// facade
func (s *Service) Payment() *payment.Service { return s.payment }
```

- [ ] **Step 4: 验证编译 + 启动**

```bash
go build ./...
make run   # Ctrl-C 停
```

Expected: 编译通过；启动日志含 payment module resolved（mode=module）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(config): wire payment thirdcall + domain service"
```

---

## Task 3: 若 payment 有表——migrate 追加

**Files:**
- Modify: `cmd/server/migrate.go`

> payment-service 若无 DB（如纯转发/计算），跳过本 Task。 Sonyflake gid 亦无 DB，跳过。

- [ ] **Step 1: runMigration 追加 paymentpkg.Migrate**

```go
import (
    paymentpkg "github.com/servekit/payment-service/pkg"
    // ...既有 userservice/storageservice/messageservice
)

func runMigration(db *gorm.DB) error {
    for _, m := range []func(*gorm.DB) error{
        userservice.Migrate,
        storageservice.Migrate,
        messageservice.Migrate,
        paymentpkg.Migrate, // 新增
    } {
        if err := m(db); err != nil {
            return err
        }
    }
    return nil
}
```

- [ ] **Step 2: 验证迁移**

```bash
go run ./cmd/server migrate
```

Expected: payment 表建在共享 PG（无外键，仅 UNIQUE/索引，与既有三服务约定一致）。

- [ ] **Step 3: Commit**

```bash
git add cmd/server/migrate.go
git commit -m "feat(migrate): add payment tables"
```

---

## Task 4: 自包含 proto + 映射层（payment 域）

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`
- Create: `internal/service/payment/payment.go`
- Create: `internal/service/payment/payment_test.go`

沿用 P1 Task 12（proto + 镜像 enum）+ Task 13（service 域 + 映射 + 测试）。payment 域「我的支付」类 RPC：caller user_id 从 ctx 注入，testkit request 不含 user_id。

- [ ] **Step 1: proto 追加 payment 域（RPC + 自定义 message + enum）**

追加到 `api/proto/testkit/v1/testkit.proto`（同 service TestKitService 内）：

```proto
// ---- Payment (P6) ----
// 枚举镜像 payment-service 同名同号（int 直转）。
enum PaymentStatus {
  PAYMENT_STATUS_UNSPECIFIED = 0;
  PAYMENT_STATUS_PENDING = 1;
  PAYMENT_STATUS_SUCCEEDED = 2;
  PAYMENT_STATUS_FAILED = 3;
}

message Payment {
  int64 id = 1;
  int64 amount = 2;            // 分
  string currency = 3;
  PaymentStatus status = 4;
  google.protobuf.Timestamp created_at = 5;
}

message CreatePaymentRequest {
  int64 amount = 1 [(buf.validate.field).int64.gt = 0];
  string currency = 2 [(buf.validate.field).string.len = 3]; // ISO 4217
  // 不含 user_id：BFF 从 ctx 注入到下游 paymentv1.CreatePaymentRequest.user_id
}

message GetPaymentRequest {
  int64 id = 1 [(buf.validate.field).int64.gt = 0]; // 目标资源 ID，保留
}

message ListMyPaymentsRequest {
  int32 page_size = 1 [(buf.validate.field).int32 = {gte: 1, lte: 200}];
  string page_token = 2 [(buf.validate.field).string.max_len = 256];
  // 不含 user_id：BFF 从 ctx 注入
}

message ListMyPaymentsResponse {
  repeated Payment payments = 1;
  string next_page_token = 2;
}
```

在 `service TestKitService { ... }` 追加 RPC（带 http 注解）：

```proto
  rpc CreatePayment(CreatePaymentRequest) returns (Payment) {
    option (google.api.http) = { post: "/api/v1/payments" body: "*" };
  }
  rpc GetPayment(GetPaymentRequest) returns (Payment) {
    option (google.api.http) = { get: "/api/v1/payments/{id}" };
  }
  rpc ListMyPayments(ListMyPaymentsRequest) returns (ListMyPaymentsResponse) {
    option (google.api.http) = { get: "/api/v1/payments" };
  }
```

- [ ] **Step 2: make proto**

```bash
make proto
```

Expected: `gen/testkit/v1/` 含 payment message/RPC；`api/swagger/testkit/v1/testkit.swagger.json` 含 payment paths。

- [ ] **Step 3: 写 payment 映射测试（失败）**

`internal/service/payment/payment_test.go`：

```go
package payment_test

import (
    "context"
    "testing"

    paymentv1 "github.com/servekit/payment-service/gen/payment/v1"
    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    "github.com/servekit/testkit-service/internal/service/payment"
    "github.com/stretchr/testify/require"
)

func TestCreatePayment_InjectsUserIDFromCtx(t *testing.T) {
    svc := payment.New(stubPayment{})
    resp, err := svc.CreatePayment(withUserID(context.Background(), 42), &testkitv1.CreatePaymentRequest{
        Amount: 1000, Currency: "CNY",
    })
    require.NoError(t, err)
    require.Equal(t, int64(42), resp.seenUserID) // stub 断言下游收到 ctx 注入的 user_id
}

// stubPayment 实现 payment.PaymentClient（记录传入的 user_id）。
type stubPayment struct{ seenUserID int64 }
// ...实现 CreatePayment/GetPayment/ListMyPayments（paymentv1 类型）
```

> 注：`withUserID` / `UserIDFrom` 用 P1 Task 11 建立的 ctx helper。stub 形状照 P1 Task 13 `stubUser`。

- [ ] **Step 4: 运行测试，确认失败**

```bash
go test ./internal/service/payment/...
```

Expected: FAIL（payment.New / 映射未实现）。

- [ ] **Step 5: 写 payment.go（映射层）**

`internal/service/payment/payment.go`：

```go
// Package payment maps testkit payment DTOs to payment-service and back.
package payment

import (
    "context"

    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    "github.com/servekit/testkit-service/pkg/auth" // UserIDFrom ctx helper（P1 Task 11）
    paymentv1 "github.com/servekit/payment-service/gen/payment/v1"
)

// Client is the payment-service subset (typed in paymentv1).
type Client interface {
    CreatePayment(ctx context.Context, req *paymentv1.CreatePaymentRequest) (*paymentv1.Payment, error)
    GetPayment(ctx context.Context, req *paymentv1.GetPaymentRequest) (*paymentv1.Payment, error)
    ListMyPayments(ctx context.Context, req *paymentv1.ListMyPaymentsRequest) (*paymentv1.ListMyPaymentsResponse, error)
}

type Service struct{ cli Client }

func New(cli Client) *Service { return &Service{cli: cli} }

func (s *Service) CreatePayment(ctx context.Context, req *testkitv1.CreatePaymentRequest) (*testkitv1.Payment, error) {
    uid, err := auth.UserIDFrom(ctx)
    if err != nil {
        return nil, err
    }
    resp, err := s.cli.CreatePayment(ctx, &paymentv1.CreatePaymentRequest{
        UserId:   uid, // 从 ctx 注入——不在 testkit request 里
        Amount:   req.GetAmount(),
        Currency: req.GetCurrency(),
    })
    if err != nil {
        return nil, err
    }
    return toTestkitPayment(resp), nil
}

func (s *Service) GetPayment(ctx context.Context, req *testkitv1.GetPaymentRequest) (*testkitv1.Payment, error) {
    resp, err := s.cli.GetPayment(ctx, &paymentv1.GetPaymentRequest{Id: req.GetId()})
    if err != nil {
        return nil, err
    }
    return toTestkitPayment(resp), nil
}

func (s *Service) ListMyPayments(ctx context.Context, req *testkitv1.ListMyPaymentsRequest) (*testkitv1.ListMyPaymentsResponse, error) {
    uid, err := auth.UserIDFrom(ctx)
    if err != nil {
        return nil, err
    }
    resp, err := s.cli.ListMyPayments(ctx, &paymentv1.ListMyPaymentsRequest{
        UserId: uid, PageSize: req.GetPageSize(), PageToken: req.GetPageToken(),
    })
    if err != nil {
        return nil, err
    }
    return toTestkitPaymentList(resp), nil
}

// --- converters ---

func toTestkitPayment(p *paymentv1.Payment) *testkitv1.Payment {
    if p == nil {
        return nil
    }
    return &testkitv1.Payment{
        Id:        p.GetId(),
        Amount:    p.GetAmount(),
        Currency:  p.GetCurrency(),
        Status:    testkitv1.PaymentStatus(p.GetStatus()), // enum int 直转
        CreatedAt: p.GetCreatedAt(),
    }
}

func toTestkitPaymentList(r *paymentv1.ListMyPaymentsResponse) *testkitv1.ListMyPaymentsResponse {
    out := &testkitv1.ListMyPaymentsResponse{NextPageToken: r.GetNextPageToken()}
    for _, p := range r.GetPayments() {
        out.Payments = append(out.Payments, toTestkitPayment(p))
    }
    return out
}
```

- [ ] **Step 6: 运行测试，确认通过**

```bash
go test ./internal/service/payment/...
```

Expected: PASS。

- [ ] **Step 7: handler + facade 接入**

`pkg/handler/testkit.go` 追加委托（照 P1 Task 14）：

```go
func (h *Handler) CreatePayment(ctx context.Context, req *testkitv1.CreatePaymentRequest) (*testkitv1.Payment, error) {
    return h.svc.Payment().CreatePayment(ctx, req)
}
func (h *Handler) GetPayment(ctx context.Context, req *testkitv1.GetPaymentRequest) (*testkitv1.Payment, error) {
    return h.svc.Payment().GetPayment(ctx, req)
}
func (h *Handler) ListMyPayments(ctx context.Context, req *testkitv1.ListMyPaymentsRequest) (*testkitv1.ListMyPaymentsResponse, error) {
    return h.svc.Payment().ListMyPayments(ctx, req)
}
```

- [ ] **Step 8: 全量构建 + 测试**

```bash
make proto && go build ./... && go test ./...
```

Expected: PASS。

- [ ] **Step 9: Commit**

```bash
git add api/proto/ gen/ internal/service/payment/ pkg/handler/testkit.go
git commit -m "feat(payment): self-contained proto + mapping layer"
```

---

## Task 5: 前端「支付」页面（用生成 service）

**Files:**
- Modify: `web/config/routes.ts`
- Create: `web/src/pages/Payment/List.tsx`

沿用 P1 Task 17（生成 service、Bearer from localStorage）。

- [ ] **Step 1: 重生 services**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto
cd web && npm run openapi
```

Expected: `src/services/testkit/` 含 `createPayment`/`getPayment`/`listMyPayments`（operationId 来自 simple_operation_ids）。

- [ ] **Step 2: 菜单**

`web/config/routes.ts` 在侧边栏加（**按双轨模型选 access**，见 P1 Task 17：内部管理类 `canInternal`、用户自助类 `canUser`；payment 作为用户自助功能用 `canUser`，若是内部管理功能则改 `canInternal`）：

```ts
{ path: '/payment', name: '支付', icon: 'wallet', access: 'canUser' },
```

- [ ] **Step 3: 支付列表页（ProTable + 生成 service）**

`web/src/pages/Payment/List.tsx`：

```tsx
import { ProTable } from '@ant-design/pro-components';
import { listMyPayments } from '@/services/testkit';

export default function PaymentList() {
  return (
    <ProTable
      rowKey="id"
      request={async (params) => {
        const data = await listMyPayments({ pageSize: params.pageSize, pageToken: params.current?.toString() });
        return { data: data.payments ?? [], success: true };
      }}
      columns={[
        { title: 'ID', dataIndex: 'id' },
        { title: '金额(分)', dataIndex: 'amount' },
        { title: '币种', dataIndex: 'currency' },
        { title: '状态', dataIndex: 'status' },
        { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
      ]}
    />
  );
}
```

> 注：生成函数名以 `npm run openapi` 产物为准（operationId 为 `CreatePayment`/`ListMyPayments`，可能大小写化）。无手写 fetch/axios。

- [ ] **Step 4: 起栈 + 验证**

```bash
cd /Users/moss/code/servekit/testkit-service
docker compose up --build -d
# 登录后侧边栏出现「支付」→ 列表页用生成 service 拉到数据
```

Expected: 支付页正常、请求带 Bearer、数据来自 `/api/v1/payments`。

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat(web): payment list page (generated services)"
```

---

## 验收检查（P6 完成时跑）

- [ ] `go build ./...` 通过、`golangci-lint run ./...` 无 error
- [ ] testkit.proto 仍**不 import 任何下游 proto**（grep 仅标准件）；payment 枚举镜像 payment-service 同名同号
- [ ] `paymentv1` 只被 `internal/thirdcall/payment/` + `internal/service/payment/` import（grep 校验边界）
- [ ] payment 域「我的支付」RPC 的 testkit request **不含 user_id**（ctx 注入）；映射层单测覆盖
- [ ] `make proto && git diff --exit-code`；前端 `npm run openapi` 生成 payment services、页面无手写 fetch
- [ ] 既有五域（auth/user/storage/message/gid+dashboard）未被触碰（`git diff` 仅增量）
- [ ] docker compose 全栈起来，「支付」菜单可用

---

## 配方小结（加任意新服务 = 以下四步）

1. **thirdcall 双层**：抄 `pkg/thirdcall/<name>.go` + `internal/thirdcall/<name>/{module,grpc}.go`，`go get github.com/servekit/<name>-service@latest`。
2. **装配**：`config.go`(ThirdPartyConfig.<Name>) + `option.go`(With<Name>) + `service.go`(NewXxx + facade) + `config.example.yaml`/`.env.example`；有表则 `migrate.go` 追加。
3. **自包含 proto + 映射**：`testkit.proto` 追加域 RPC+message+镜像 enum；`internal/service/<name>/<name>.go` 做 testkit↔下游映射（唯一 import 下游 gen 处之一）；ctx 注入调用方身份。
4. **前端**：`make proto` + `npm run openapi` → `web/src/pages/<Name>/` + `routes.ts` 菜单；用生成 service。

---

## 关联

**设计文档：**
- [[2026-07-29-testkit-service-design]]（v2，§3 自包含 proto + 映射、§6 thirdcall、§8 P6）

**前置 plan：**
- [[2026-07-28-testkit-service-p1-foundation]]（地基 + 认证闭环，thirdcall/adapter/option/service.go/migrate/frontend 模板源）
- P2 用户、P3 文件、P4 消息、P5 gid+仪表盘（域 plan）
