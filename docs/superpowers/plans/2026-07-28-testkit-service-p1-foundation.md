# testkit-service P1（地基 + 认证闭环）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ## ⚠️ v2 更新（2026-07-29）
> 本计划已按 **[[2026-07-29-testkit-service-design]]（v2 设计）** 修订。v1 把「proto 自定义、不 import 兄弟 proto」当作 spec 偏差；**v2 已将其扶正为正式设计**（自包含 proto + 映射层 + swagger 前端联动），见 v2 §3/§4/§5。本计划下方「关键决策」已据此改写，且以下三处 Task 有 **v2 增补**（执行时以增补内容为准）：
> - **Task 2**：scaffold 的 `buf.gen.yaml` 已自带 `openapiv2` 插件 → `make proto` 即产出 `api/swagger/testkit/v1/testkit.swagger.json`（v2 Delta B，无需额外 Task，仅在验收确认）。
> - **Task 12**：auth 的枚举字段（method/provider/channel/purpose）从 v1 的 `string` 改为 **testkit 自有 proto enum**（镜像 user-service 同名同号 enum），并修正 v1 里错误的 `string.len=1` 校验。映射用整型直转，见 Task 13。
> - **Task 17**：前端登录页从手写 `fetch` 改为 **`npm run openapi` 生成的 services**（v2 Delta C：swagger2openapi 2.0→3.0 + `max openapi`）。
> 映射层位置（v2 §3.3）= `internal/service/auth/auth.go`，与下方 Task 13 一致（v1 早期 prose 说「handler 层」以 Task 13 实现为准）。

**Goal:** 搭起 testkit-service 单进程 BFF 骨架——in-process embed 四个下游服务、JWT 鉴权闭环、统一迁移、docker-compose 全栈、Ant Design Pro v6 登录页，跑通「登录 → 带 token 调 Ping」。

**Architecture:** testkit-service 是标准 go-common gRPC + grpc-gateway 服务（`new-service.sh` 生成）。四个下游用 thirdcall `mode=module` in-process embed，共享同一组 PG/Redis 连接池；下游的 gid/message 接口类型不兼容，testkit 写 adapter 桥接。鉴权：JWT（承载 session_id）→ `grpcx.BearerTokenFromCtx` 取 token → user-service `GetSession` 换 user_id → `context.WithValue(ctx, grpcx.UserIDKey, id)` 注入 ctx。

**Tech Stack:** Go 1.26 + go-common（grpcx/lifecycle/signalx/configx/dbx/redisx/ratelimit）+ golang-jwt/jwt/v5 + buf v2 + grpc-gateway；前端 Ant Design Pro v6（React 19 + antd 6 + Umi Max 4）。

---

## 关键决策与 spec 偏差（实现前必读）

1. **proto 自定义 message，不 import 兄弟 proto**（v2 §3 正式决策；本计划原先记为「偏离 spec §10」，v2 已扶正）。
   - 原因：现仓库 proto 都未发布到 BSR，testkit `import "user/v1/user.proto"` 需要的 buf 跨仓库 dependency 在本地结构下不优雅；且 BFF 标准模式就是前端 DTO 解耦于下游 proto（可裁剪/聚合字段、枚举在 testkit 重新定义、把「调用方身份」字段下沉到 ctx 注入）。
   - 做法：testkit proto 自定义面向前端的 message（字段与下游对齐但独立类型），**枚举在 testkit proto 重新定义**（镜像下游同名同号）；`internal/service/<domain>/`（auth 域 = `internal/service/auth/auth.go`）做 testkit message ↔ 下游 message 的映射，是唯一同时 import `testkitv1` 与下游 gen 的地方。
   - **依赖边界**（v2 §3.4）：下游 gen 只被 `internal/thirdcall/<name>/`（client 接线）+ `internal/service/<domain>/`（映射）import；`pkg/handler`、testkit proto、前端对下游类型完全无感。（authn 边界：`pkg/auth` 拦截器为校验 session 会 import `userv1.GetSession*`，属显式例外。）
   - P1 只有 6 个 auth RPC，自定义成本低。

2. **gid/message adapter**（补充 spec §6.3）。
   - user/storage/message 各自定义了 `thirdcall.GIDService`（形状都是 `NextID(ctx)(int64,error)`，但是不同 Go 接口类型）；gid handler 的 `NextID` 是 proto 类型，不能直接注入。
   - 做法：testkit 写 `gidAdapter`（一个 `NextID(ctx)(int64,error)` 方法，内部调共享的 gid handler），靠 Go 结构式类型同时满足三个服务的 `thirdcall.GIDService`，注入三服务；`messageAdapter` 同理注入 user。

3. **go.mod 远程依赖，无 replace**（与仓库约定一致）。scaffold 生成后 `go get github.com/servekit/{user,storage,message,gid}-service@latest`。

4. **gateway 无需自定义 header matcher**：`runtime.NewServeMux()` 默认转发 `authorization` 到 gRPC metadata，`grpcx.BearerTokenFromCtx` 直接可用。

---

## File Structure

P1 涉及的文件（创建/修改）：

```
testkit-service/
├── api/proto/testkit/v1/testkit.proto      # TestKitService（自定义 message）[改]
├── cmd/server/main.go                       # serve/migrate dispatch [框架已有]
├── cmd/server/migrate.go                    # runMigration 调三服务 pkg.Migrate [改]
├── internal/
│   ├── jwt/jwt.go                           # Sign/Verify HS256 [建]
│   ├── jwt/jwt_test.go                      # [建]
│   ├── service/service.go                   # 构造 4 module + 共享 db/redis + lifecycle [改]
│   ├── service/auth/auth.go                 # Login/Register/.../转发 + JWT 签发 [建]
│   ├── thirdcall/                           # 4 下游 module 实现 [改/建]
│   │   ├── gid/module.go
│   │   ├── message/module.go
│   │   ├── storage/module.go
│   │   └── user/module.go
│   ├── adapter/adapter.go                   # gidAdapter + messageAdapter [建]
│   └── version/                             # [框架已有]
├── pkg/
│   ├── server.go                            # grpcx.New + AuthInterceptor 装配 [改]
│   ├── handler/testkit.go                   # TestKitService 薄壳 [改]
│   ├── handler/migrate.go                   # Migrate(db) 重导出 [框架已有/改]
│   ├── config/config.go                     # 聚合配置 [改]
│   ├── option/option.go                     # WithUser/Storage/Message/GID/DB/Redis [改]
│   ├── thirdcall/                           # 4 接口 + 工厂 [改/建]
│   │   ├── gid.go  message.go  storage.go  user.go
│   ├── auth/interceptor.go                  # AuthInterceptor + 白名单 [建]
│   ├── auth/interceptor_test.go             # [建]
│   └── xcodes/testkit.go                    # [改]
├── buf.yaml  buf.gen.yaml                   # [框架已有]
├── config.example.yaml                      # 聚合配置结构 [改]
├── .env.example                             # [改]
├── docker-compose.yaml                      # PG/Redis/testkit(migrate+serve)/nginx [建]
├── Dockerfile                               # render.sh 产出 [建]
├── Makefile                                 # 加 migrate-deps 已废弃，保留标准 target [框架已有]
└── web/                                     # Ant Design Pro v6 [建]
    ├── (React 项目)
    ├── Dockerfile
    └── nginx.conf
```

**职责边界**：`pkg/thirdcall/` 定义接口+工厂（外部契约），`internal/thirdcall/<name>/` 实现（唯一 import 下游 gen 处），`internal/adapter/` 做跨服务接口桥接，`internal/jwt` 纯 JWT，`pkg/auth` 拦截器（依赖 jwt + user handler）。

---

## Task 1: scaffold 生成 + 四服务依赖

**Files:**
- Create: `testkit-service/`（整个骨架）
- Modify: `testkit-service/go.mod`

- [ ] **Step 1: 生成骨架**

从 `servekit/` 根执行（scaffold 默认 target = dev-skills 平级目录，即 `servekit/`）：

```bash
cd /Users/moss/code/servekit
./dev-skills/skills/golang-service-development/scripts/new-service.sh testkit --thirdcall --redis
cd testkit-service
make tidy
make proto
```

Expected: `testkit-service/` 生成，`gen/testkit/v1/` 有生成代码，`go build ./...` 通过（scaffold 自带 demo 样板能编译）。

- [ ] **Step 2: 加四个下游服务依赖**

```bash
cd /Users/moss/code/servekit/testkit-service
go get github.com/servekit/user-service@latest
go get github.com/servekit/storage-service@latest
go get github.com/servekit/message-service@latest
go get github.com/servekit/gid-service@latest
go get github.com/golang-jwt/jwt/v5@latest
make tidy
```

Expected: `go.mod` 的 `require` 段出现四个 `github.com/servekit/<svc>-service` + `golang-jwt/jwt/v5`，`go.sum` 更新。

- [ ] **Step 3: 验证构建**

```bash
go build ./...
```

Expected: PASS（demo 样板仍能编译）。

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: scaffold testkit-service + add four downstream deps"
```

---

## Task 2: 清理 demo 样板，proto 留 TestKitService 空壳 + Ping

scaffold 生成了一套以 `testkit` 为名的 demo CRUD（`TestKit` 模型）。P1 先清掉业务，留最小可编译骨架（`Ping` only）。

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`
- Delete: `internal/service/testkit/`、`internal/store/{models,generated,dal}/testkit*`、`pkg/xcodes/testkit.go`（demo 错误码）
- Modify: `internal/service/service.go`、`pkg/handler/testkit.go`、`pkg/server.go`、`pkg/client.go`、`pkg/module.go`（移除 demo 引用）

- [ ] **Step 1: 重写 proto 为最小 TestKitService（Ping）**

`api/proto/testkit/v1/testkit.proto`：

```proto
syntax = "proto3";

package testkit.v1;

import "google/api/annotations.proto";
import "google/protobuf/empty.proto";
import "buf/validate/proto/validate.proto";

// PingResponse is the health-check payload.
message PingResponse {
  string service = 1;
  string version = 2;
}

service TestKitService {
  rpc Ping(google.protobuf.Empty) returns (PingResponse) {
    option (google.api.http) = { get: "/api/v1/health" };
  }
}
```

- [ ] **Step 2: 重生成**

```bash
make proto
```

Expected: `gen/testkit/v1/testkit.pb.go` 等重生，只有 `Ping` + `PingResponse`。

- [ ] **Step 3: 删除 demo 业务文件**

```bash
rm -rf internal/service/testkit
rm -f internal/store/models/testkit.go internal/store/generated/testkit.go internal/store/dal/testkit.go
rm -f pkg/xcodes/testkit.go
# store/models/register.go 里删 testkit 的注册行（如果有）
```

注：`store/` 下若只剩空目录，P1 不需要 store（无 --db），可整个删 `internal/store/`；Makefile 的 `generate` target 若引用了 models 路径，临时注释掉或留空 models 目录。

- [ ] **Step 4: 重写 service.go（最小本体 + Ping facade）**

`internal/service/service.go`：

```go
// Package service is the testkit-service business layer.
package service

import (
    "context"

    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    "github.com/servekit/testkit-service/internal/version"
    "google.golang.org/protobuf/types/known/emptypb"
)

// Service holds all domain sub-services. P1 has no domain yet.
type Service struct{}

// New constructs the Service.
func New() (*Service, error) {
    return &Service{}, nil
}

// Start starts background components (none in P1).
func (s *Service) Start() error { return nil }

// Stop tears down components (none in P1).
func (s *Service) Stop() error { return nil }

// Ping is the health-check facade.
func (s *Service) Ping(ctx context.Context, req *emptypb.Empty) (*testkitv1.PingResponse, error) {
    return &testkitv1.PingResponse{
        Service: "testkit-service",
        Version: version.Get().Version,
    }, nil
}
```

- [ ] **Step 5: 重写 handler（薄壳）**

`pkg/handler/testkit.go`：

```go
// Package handler is the thin gRPC shell over service.
package handler

import (
    "context"

    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    "github.com/servekit/testkit-service/internal/service"
    "google.golang.org/protobuf/types/known/emptypb"
)

// Handler implements testkitv1.TestKitServiceServer.
type Handler struct {
    testkitv1.UnimplementedTestKitServiceServer
    svc *service.Service
}

// New creates a Handler.
func New(svc *service.Service) *Handler { return &Handler{svc: svc} }

// Ping delegates to service.
func (h *Handler) Ping(ctx context.Context, req *emptypb.Empty) (*testkitv1.PingResponse, error) {
    return h.svc.Ping(ctx, req)
}

// Start/Stop satisfy signalx.Service (forward to service).
func (h *Handler) Start() error { return h.svc.Start() }
func (h *Handler) Stop() error  { return h.svc.Stop() }
```

- [ ] **Step 6: 修正 server.go / client.go / module.go 引用**

确保 `pkg/server.go` 用 `service.New()` + `handler.New(svc)`，`grpcx.New` 注册 `testkitv1.RegisterTestKitServiceServer`。`module.go` 的 `NewModule` 调 `service.New()`。这些 scaffold 已有模板，只需确认 demo 引用已清。

- [ ] **Step 7: 验证构建 + 启动**

```bash
go build ./...
make run   # 启动后 Ctrl-C 停
```

Expected: 编译通过；`make run` 起服务（gRPC :19095 + gateway :18085，端口在 Task 3 配置后生效；先用 scaffold 默认端口验证能起）。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: strip demo scaffold, leave minimal TestKitService Ping"
```

---

## Task 3: pkg/config 聚合配置

**Files:**
- Modify: `pkg/config/config.go`
- Create: `pkg/config/config_test.go`

- [ ] **Step 1: 写 config 测试（加载 + 默认值）**

`pkg/config/config_test.go`：

```go
package config_test

import (
    "os"
    "testing"

    "github.com/servekit/testkit-service/pkg/config"
    "github.com/stretchr/testify/require"
)

func TestLoad_Defaults(t *testing.T) {
    // Minimal env to satisfy ${VAR} expansion in config.example.yaml.
    t.Setenv("TESTKIT_CONFIG", "config.example.yaml")
    os.Chdir("../../../") // run from pkg/config/ — adjust to repo root where config.example.yaml lives
    cfg, err := config.Load()
    require.NoError(t, err)
    require.Equal(t, ":19095", cfg.Server.GRPCAddr)
    require.Equal(t, ":18085", cfg.Server.GatewayAddr)
    require.NotNil(t, cfg.JWT)
    require.Equal(t, "2h", cfg.JWT.TTL.String()) // default 2h
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./pkg/config/...
```

Expected: FAIL（新字段未定义）。

- [ ] **Step 3: 重写 config.go**

`pkg/config/config.go`：

```go
// Package config provides service configuration loading.
package config

import (
    "time"

    "github.com/servekit/go-common/configx"
    "github.com/servekit/go-common/dbx"
    "github.com/servekit/go-common/logging"
    "github.com/servekit/go-common/redisx"

    gidconfig "github.com/servekit/gid-service/pkg/config"
    messageconfig "github.com/servekit/message-service/pkg/config"
    storageconfig "github.com/servekit/storage-service/pkg/config"
    userconfig "github.com/servekit/user-service/pkg/config"
)

const (
    serviceName = "testkit-service"
    envPrefix   = "TESTKIT"
)

// Config holds all testkit-service configuration.
type Config struct {
    Server     *ServerConfig
    Database   *dbx.Config
    Redis      *redisx.Config
    JWT        *JWTConfig
    CORS       *CORSConfig
    ThirdParty *ThirdPartyConfig
    Log        *logging.Config
}

// ServerConfig holds gRPC + gateway listener addresses.
type ServerConfig struct {
    GRPCAddr    string `default:":19095"`
    GatewayAddr string `default:":18085"`
}

// JWTConfig holds JWT signing parameters.
type JWTConfig struct {
    Secret string // ${VAR} expanded; required
    TTL    time.Duration `default:"2h"`
}

// CORSConfig holds allowed origins for the gateway.
type CORSConfig struct {
    AllowedOrigins []string
}

// ThirdPartyConfig holds the four downstream service configs (mode=module by default).
type ThirdPartyConfig struct {
    GID     *RemoteServiceConfig[*gidconfig.Config]
    Message *RemoteServiceConfig[*messageconfig.Config]
    Storage *RemoteServiceConfig[*storageconfig.Config]
    User    *RemoteServiceConfig[*userconfig.Config]
}

// RemoteServiceConfig re-uses user-service's shape (mode | target | module config).
type RemoteServiceConfig[T any] struct {
    Mode   string // "module" | "grpc"
    Target string // gRPC addr when mode=grpc
    Config T      // module-mode config
}

// Load reads config from file + env.
func Load() (*Config, error) {
    var cfg Config
    if err := configx.Load(&cfg,
        configx.WithServiceName(serviceName),
        configx.WithEnvPrefix(envPrefix),
        configx.WithExpandEnv(),
    ); err != nil {
        return nil, err
    }
    return &cfg, nil
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./pkg/config/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add pkg/config/
git commit -m "feat(config): aggregate four downstream + JWT/CORS config"
```

---

## Task 4: config.example.yaml + .env.example

**Files:**
- Modify: `config.example.yaml`
- Modify: `.env.example`

- [ ] **Step 1: 写 config.example.yaml（纯结构 + ${VAR}）**

`config.example.yaml`：

```yaml
server:
  grpc_addr: ":19095"
  gateway_addr: ":18085"

database:
  host: ${DATABASE_HOST}
  port: 5432
  user: ${DATABASE_USER}
  password: ${DATABASE_PASSWORD}
  db_name: ${DATABASE_DB_NAME}
  ssl_mode: disable

redis:
  addr: ${REDIS_ADDR}

jwt:
  secret: ${JWT_SECRET}
  ttl: 2h

cors:
  allowed_origins:
    - "http://localhost:8080"

third_party:
  gid:
    mode: module
    config:
      snowflake:
        machine_id: 1
  message:
    mode: module
    config: {}
  storage:
    mode: module
    config: {}
  user:
    mode: module
    config: {}

log:
  level: info
  format: text
```

注：`third_party.*.config` 的具体字段对齐各服务 Config（DB/Redis 由 testkit 共享注入，故下游 config 里可留空或最小）。实际下游 Config 是 `*userconfig.Config` 等，含 Database/Redis 字段——但 testkit 用 `option.WithDB/WithRedis` 注入共享连接，会覆盖下游自建。下游 config 里 Database/Redis 可留占位（被 option 覆盖）。

- [ ] **Step 2: 写 .env.example**

`.env.example`：

```env
DATABASE_HOST=localhost
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_DB_NAME=testkit
REDIS_ADDR=localhost:6379
JWT_SECRET=change-me-in-prod
```

- [ ] **Step 3: 验证加载**

```bash
cp .env.example .env
go test ./pkg/config/...
```

Expected: PASS（`${VAR}` 从 .env 展开）。

- [ ] **Step 4: Commit**

```bash
git add config.example.yaml .env.example
git commit -m "feat(config): add config.example.yaml + .env.example"
```

---

## Task 5: thirdcall 四下游（pkg/thirdcall 接口 + internal/thirdcall module 实现）

scaffold 的 `--thirdcall` 生成了 1 个占位（dual-mode 教学）。删掉它，建 4 个下游的 module 实现（mode=module 默认，grpc 留 stub）。

**Files:**
- Delete: scaffold 的 thirdcall 占位（`pkg/thirdcall/<占位>.go`、`internal/thirdcall/<占位>/`、option/config 里的占位字段）
- Create: `internal/thirdcall/{gid,message,storage,user}/module.go` + `grpc.go`
- Modify: `pkg/thirdcall/`（4 接口 + 工厂）

- [ ] **Step 1: 删除 scaffold 的 thirdcall 占位**

```bash
# 列出 scaffold 生成的 thirdcall 占位文件（名为 testkit 或 demo）
ls pkg/thirdcall/ internal/thirdcall/
# 删除占位（按实际文件名）
rm -f pkg/thirdcall/testkit.go
rm -rf internal/thirdcall/testkit
# option.go / config.go 里删占位的 XxxService 字段 + WithXxx（Task 7 重建）
```

- [ ] **Step 2: 建 internal/thirdcall/user/module.go**

`internal/thirdcall/user/module.go`：

```go
// Package user is the in-process adapter for user-service.
package user

import (
    "fmt"

    "github.com/servekit/user-service/pkg"
    "github.com/servekit/user-service/pkg/config"
    "github.com/servekit/user-service/pkg/option"
)

// Handler is the type testkit holds (= user-service *handler.Handler).
type Handler = pkg.Handler

// NewModule constructs an in-process user-service from config.
func NewModule(cfg *config.Config, opts ...option.Option) (*Handler, error) {
    hdl, err := pkg.NewModule(cfg, opts...)
    if err != nil {
        return nil, fmt.Errorf("user module: %w", err)
    }
    return hdl, nil
}
```

- [ ] **Step 3: 建 internal/thirdcall/user/grpc.go**

`internal/thirdcall/user/grpc.go`：

```go
package user

import (
    "fmt"

    "github.com/servekit/user-service/pkg"
)

// NewGRPC dials a remote user-service. Reserved for mode=grpc.
func NewGRPC(target string) (*pkg.Client, error) {
    c, err := pkg.NewClient(target)
    if err != nil {
        return nil, fmt.Errorf("user grpc: %w", err)
    }
    return c, nil
}
```

- [ ] **Step 4: 重复 Step 2-3，建 message / storage / gid**

`internal/thirdcall/message/module.go`（同理，调 `message-service/pkg`）：

```go
package message

import (
    "fmt"

    "github.com/servekit/message-service/pkg"
    "github.com/servekit/message-service/pkg/config"
    "github.com/servekit/message-service/pkg/option"
)

type Handler = pkg.Handler

func NewModule(cfg *config.Config, opts ...option.Option) (*Handler, error) {
    hdl, err := pkg.NewModule(cfg, opts...)
    if err != nil {
        return nil, fmt.Errorf("message module: %w", err)
    }
    return hdl, nil
}
```

`internal/thirdcall/message/grpc.go`：同 user grpc.go，调 `message.NewClient`。

`internal/thirdcall/storage/module.go`（注意 storage pkg 包名是 `pkg`，必须 alias）：

```go
package storage

import (
    "fmt"

    storageservice "github.com/servekit/storage-service/pkg"
    "github.com/servekit/storage-service/pkg/config"
    "github.com/servekit/storage-service/pkg/option"
)

type Handler = storageservice.Handler

func NewModule(cfg *config.Config, opts ...option.Option) (*Handler, error) {
    hdl, err := storageservice.NewModule(cfg, opts...)
    if err != nil {
        return nil, fmt.Errorf("storage module: %w", err)
    }
    return hdl, nil
}
```

`internal/thirdcall/storage/grpc.go`：调 `storageservice.NewClient`。

`internal/thirdcall/gid/module.go`（gid 无 option）：

```go
package gid

import (
    "fmt"

    gidservice "github.com/servekit/gid-service/pkg"
    "github.com/servekit/gid-service/pkg/config"
)

type Handler = gidservice.Handler

func NewModule(cfg *config.Config) (*Handler, error) {
    hdl, err := gidservice.NewModule(cfg)
    if err != nil {
        return nil, fmt.Errorf("gid module: %w", err)
    }
    return hdl, nil
}
```

`internal/thirdcall/gid/grpc.go`：调 `gidservice.NewClient`。

- [ ] **Step 5: 建 pkg/thirdcall/ 接口 + 工厂**

`pkg/thirdcall/user.go`：

```go
// Package thirdcall defines downstream service interfaces + factories.
package thirdcall

import (
    "github.com/servekit/testkit-service/internal/thirdcall/user"
    "github.com/servekit/user-service/pkg/config"
)

// UserService is the in-process user-service capability testkit uses.
type UserService = user.Handler

// NewUserService resolves user-service by mode.
func NewUserService(cfg *config.Config, moduleOpts []any) (UserService, error) {
    // moduleOpts typed loosely; service.go passes real options. See Task 8.
    return user.NewModule(cfg)
}
```

> 实现注记：四个工厂的 option 透传在 Task 8 的 `service.New` 里直接调 `internal/thirdcall/*` 的 `NewModule(cfg, opts...)`，`pkg/thirdcall` 主要暴露接口类型给 handler/service 依赖。如工厂签名需带 opts，改用泛型或直接在 service.go 调 internal（后者更简单，P1 采用：service.go 直接 import `internal/thirdcall/*` 调 NewModule，`pkg/thirdcall` 只放接口别名）。

简化：`pkg/thirdcall/{gid,message,storage,user}.go` 各只放 `type XxxService = <internal>.Handler` 别名（接口即 handler 类型，因为 in-process 直接调方法）。工厂逻辑放 service.go。

重写 `pkg/thirdcall/user.go`（最终版）：

```go
package thirdcall

import "github.com/servekit/testkit-service/internal/thirdcall/user"

// UserService is the in-process user-service handler.
type UserService = user.Handler
```

`pkg/thirdcall/storage.go`、`message.go`、`gid.go` 同理（别名对应 internal handler）。

- [ ] **Step 6: 验证编译**

```bash
go build ./...
```

Expected: PASS（如有未使用 import 或 option/config 残留占位，按编译器提示清理）。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(thirdcall): wire four downstream module adapters"
```

---

## Task 6: gid/message adapter（跨服务接口桥接）

**Files:**
- Create: `internal/adapter/adapter.go`
- Create: `internal/adapter/adapter_test.go`

- [ ] **Step 1: 写 adapter 测试**

`internal/adapter/adapter_test.go`：

```go
package adapter_test

import (
    "context"
    "testing"

    "github.com/servekit/testkit-service/internal/adapter"
    "github.com/stretchr/testify/require"
)

// stubGID implements the shape needed (returns a fixed id) without a real gid handler.
type stubGID struct{ id int64 }

func (s *stubGID) NextID(ctx context.Context) (int64, error) { return s.id, nil }

func TestGIDAdapter_NextID(t *testing.T) {
    a := adapter.NewGIDAdapter(stubGID{id: 42})
    id, err := a.NextID(context.Background())
    require.NoError(t, err)
    require.Equal(t, int64(42), id)
}
```

> 注：真实 gid handler 的 `NextID` 签名是 proto 类型 `(ctx, *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error)`。adapter 持有真实 handler 时调它并取 `.GetId()`。测试用 stub（避免拉 gid handler 全链路）验证 adapter 的 NextID(ctx)(int64,error) 形状。

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/adapter/...
```

Expected: FAIL（包不存在）。

- [ ] **Step 3: 写 adapter.go**

`internal/adapter/adapter.go`：

```go
// Package adapter bridges testkit's shared handlers to downstream thirdcall
// interfaces that have identical shape but distinct Go types.
package adapter

import (
    "context"
    "fmt"

    gidv1 "github.com/servekit/gid-service/gen/gid/v1"
    messagev1 "github.com/servekit/message-service/gen/message/v1"
)

// GIDCaller is the minimal shape adapter needs from the shared gid handler
// (real *gid handler satisfies it; tests use a stub).
type GIDCaller interface {
    NextID(ctx context.Context, req *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error)
}

// GIDAdapter exposes NextID(ctx)(int64,error) — satisfying user/storage/message's
// thirdcall.GIDService (same shape, different types) via structural typing.
type GIDAdapter struct {
    caller GIDCaller
}

// NewGIDAdapter wraps a gid caller.
func NewGIDAdapter(c GIDCaller) *GIDAdapter { return &GIDAdapter{caller: c} }

// NextID returns a fresh snowflake id.
func (a *GIDAdapter) NextID(ctx context.Context) (int64, error) {
    resp, err := a.caller.NextID(ctx, &gidv1.NextIDRequest{})
    if err != nil {
        return 0, fmt.Errorf("gid next: %w", err)
    }
    return resp.GetId(), nil
}

// MessageCaller is the minimal shape from the shared message handler.
type MessageCaller interface {
    SendEmail(ctx context.Context, req *messagev1.SendEmailRequest) (*messagev1.SendResponse, error)
    SendSMS(ctx context.Context, req *messagev1.SendSMSRequest) (*messagev1.SendResponse, error)
}

// MessageAdapter satisfies user-service's thirdcall.MessageService.
type MessageAdapter struct {
    caller MessageCaller
}

// NewMessageAdapter wraps a message caller.
func NewMessageAdapter(c MessageCaller) *MessageAdapter { return &MessageAdapter{caller: c} }

// SendEmail forwards to the shared message handler.
func (a *MessageAdapter) SendEmail(ctx context.Context, req *messagev1.SendEmailRequest) (*messagev1.SendResponse, error) {
    return a.caller.SendEmail(ctx, req)
}

// SendSMS forwards to the shared message handler.
func (a *MessageAdapter) SendSMS(ctx context.Context, req *messagev1.SendSMSRequest) (*messagev1.SendResponse, error) {
    return a.caller.SendSMS(ctx, req)
}

// Close is a no-op (shared handler lifecycle owned by testkit).
func (a *MessageAdapter) Close() error { return nil }
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/adapter/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/adapter/
git commit -m "feat(adapter): gid/message structural adapters for cross-service injection"
```

---

## Task 7: pkg/option With 注入

**Files:**
- Modify: `pkg/option/option.go`

- [ ] **Step 1: 写 option.go（注入字段）**

`pkg/option/option.go`：

```go
// Package option provides functional options for service.New.
package option

import (
    "github.com/redis/go-redis/v9"
    "gorm.io/gorm"

    "github.com/servekit/testkit-service/internal/thirdcall/gid"
    "github.com/servekit/testkit-service/internal/thirdcall/message"
    "github.com/servekit/testkit-service/internal/thirdcall/storage"
    "github.com/servekit/testkit-service/internal/thirdcall/user"
)

// Options holds optionally-injected resources.
type Options struct {
    DB       *gorm.DB
    Redis    *redis.Client
    User     *user.Handler
    Storage  *storage.Handler
    Message  *message.Handler
    GID      *gid.Handler
}

// Option mutates Options.
type Option func(*Options)

// Apply resolves options.
func Apply(opts ...Option) Options {
    o := Options{}
    for _, opt := range opts {
        opt(&o)
    }
    return o
}

// WithDB injects a shared PG connection (testkit owns lifecycle when nil).
func WithDB(db *gorm.DB) Option { return func(o *Options) { o.DB = db } }

// WithRedis injects a shared Redis client.
func WithRedis(rdb *redis.Client) Option { return func(o *Options) { o.Redis = rdb } }

// WithUser injects a pre-built user-service handler.
func WithUser(h *user.Handler) Option { return func(o *Options) { o.User = h } }

// WithStorage injects a pre-built storage-service handler.
func WithStorage(h *storage.Handler) Option { return func(o *Options) { o.Storage = h } }

// WithMessage injects a pre-built message-service handler.
func WithMessage(h *message.Handler) Option { return func(o *Options) { o.Message = h } }

// WithGID injects a pre-built gid-service handler.
func WithGID(h *gid.Handler) Option { return func(o *Options) { o.GID = h } }
```

- [ ] **Step 2: 验证编译**

```bash
go build ./...
```

Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add pkg/option/
git commit -m "feat(option): WithDB/Redis/User/Storage/Message/GID"
```

---

## Task 8: service.go 构造 4 module + 共享 db/redis + lifecycle

**Files:**
- Modify: `internal/service/service.go`
- Create: `internal/service/service_test.go`

- [ ] **Step 1: 写 service 构造测试（注入 db/redis + 4 handler，Start/Stop 干净）**

`internal/service/service_test.go`：

```go
package service_test

import (
    "context"
    "testing"

    "github.com/servekit/go-common/dbx"
    "github.com/servekit/go-common/redisx"
    "github.com/servekit/testkit-service/internal/service"
    "github.com/servekit/testkit-service/pkg/config"
    "github.com/stretchr/testify/require"
)

func TestNew_ResolveDBAndRedis(t *testing.T) {
    db := dbx.SetupTestDB(t)       // postgres testcontainer
    rdb := redisx.NewTestClient(t) // miniredis

    cfg := &config.Config{ /* minimal: JWT/CORS set, ThirdParty nil → SkipResolve for now */ }
    cfg.JWT = &config.JWTConfig{Secret: "x"}
    cfg.ThirdParty = &config.ThirdPartyConfig{}

    svc, err := service.New(cfg, option.WithDB(db), option.WithRedis(rdb))
    require.NoError(t, err)
    require.NotNil(t, svc)
    require.NoError(t, svc.Start())
    require.NoError(t, svc.Stop())
}
```

> 注：完整 New 还需构造 4 个下游 module（依赖各自 config）。本测试聚焦 db/redis 注入与生命周期；4 module 的构造在 Step 3 实现里通过 `resolveDownstreams` 完成（测试里 ThirdParty 配置为空时，下游 module 构造会失败——因此本测试需提供最小下游 config，或拆成「db/resolve」与「下游构造」两个测试。P1 实现时先让 New 支持「下游 config 由 testkit config.ThirdParty 提供」）。

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/...
```

Expected: FAIL（New 签名不匹配）。

- [ ] **Step 3: 重写 service.go（构造 + lifecycle）**

`internal/service/service.go`：

```go
package service

import (
    "context"
    "errors"
    "log/slog"

    "github.com/redis/go-redis/v9"
    "gorm.io/gorm"

    "github.com/servekit/go-common/dbx"
    "github.com/servekit/go-common/lifecycle"
    "github.com/servekit/go-common/redisx"

    "github.com/servekit/testkit-service/internal/adapter"
    "github.com/servekit/testkit-service/internal/thirdcall/gid"
    "github.com/servekit/testkit-service/internal/thirdcall/message"
    "github.com/servekit/testkit-service/internal/thirdcall/storage"
    "github.com/servekit/testkit-service/internal/thirdcall/user"
    "github.com/servekit/testkit-service/pkg/config"
    "github.com/servekit/testkit-service/pkg/option"

    msgOption "github.com/servekit/message-service/pkg/option"
    stOption "github.com/servekit/storage-service/pkg/option"
    usrOption "github.com/servekit/user-service/pkg/option"

    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    "github.com/servekit/testkit-service/internal/version"
    "google.golang.org/protobuf/types/known/emptypb"
)

// Service holds shared resources + the four embedded downstream handlers.
type Service struct {
    cfg *config.Config
    mgr *lifecycle.Manager

    db    *gorm.DB
    redis *redis.Client

    user    *user.Handler
    storage *storage.Handler
    message *message.Handler
    gid     *gid.Handler
}

// New resolves resources, constructs four downstream modules, registers cleanup.
func New(cfg *config.Config, opts ...option.Option) (*Service, error) {
    o := option.Apply(opts...)
    mgr := lifecycle.NewManager()

    db, err := resolveDB(cfg, o.DB, mgr)
    if err != nil {
        return nil, errors.Join(err, mgr.Stop())
    }
    rdb, err := resolveRedis(cfg, o.Redis, mgr)
    if err != nil {
        return nil, errors.Join(err, mgr.Stop())
    }

    // Build the four downstream modules (in-process), injecting shared db/redis
    // and the gid/message adapters. Ordering + option aliases live in resolveDownstreams.
    s, err := resolveDownstreams(cfg, db, rdb, mgr)
    if err != nil {
        return nil, errors.Join(err, mgr.Stop())
    }
    s.cfg = cfg
    s.db = db
    s.redis = rdb
    return s, nil
}

// resolveDownstreams builds gid → message/storage/user with shared adapters.
func resolveDownstreams(cfg *config.Config, db *gorm.DB, rdb *redis.Client, mgr *lifecycle.Manager) (*Service, error) {
    // 1. gid first (no deps).
    gidHdl, err := gid.NewModule(cfg.ThirdParty.GID.Config)
    if err != nil {
        return nil, err
    }
    gidAdapter := adapter.NewGIDAdapter(gidHdl)

    // 2. message (needs gid adapter).
    msgHdl, err := message.NewModule(cfg.ThirdParty.Message.Config,
        msgOption.WithDB(db), msgOption.WithRedis(rdb), msgOption.WithGIDService(gidAdapter),
    )
    if err != nil {
        return nil, err
    }
    msgAdapter := adapter.NewMessageAdapter(msgHdl)

    // 3. storage (needs gid adapter).
    stHdl, err := storage.NewModule(cfg.ThirdParty.Storage.Config,
        stOption.WithDB(db), stOption.WithRedis(rdb), stOption.WithGIDService(gidAdapter),
    )
    if err != nil {
        return nil, err
    }

    // 4. user (needs gid adapter + message adapter).
    usrHdl, err := user.NewModule(cfg.ThirdParty.User.Config,
        usrOption.WithDB(db), usrOption.WithRedis(rdb),
        usrOption.WithGIDService(gidAdapter), usrOption.WithMessageService(msgAdapter),
    )
    if err != nil {
        return nil, err
    }

    return &Service{
        mgr:     mgr,
        gid:     gidHdl,
        message: msgHdl,
        storage: stHdl,
        user:    usrHdl,
    }, nil
}

func resolveDB(cfg *config.Config, injected *gorm.DB, mgr *lifecycle.Manager) (*gorm.DB, error) {
    if injected != nil {
        return injected, nil
    }
    db, err := dbx.New(cfg.Database)
    if err != nil {
        return nil, err
    }
    mgr.AddStopper("db", lifecycle.StopFunc(func() {
        sqlDB, err := db.DB()
        if err != nil {
            slog.Warn("get sql db for close", "error", err)
            return
        }
        if err := sqlDB.Close(); err != nil {
            slog.Warn("close db", "error", err)
        }
    }))
    return db, nil
}

func resolveRedis(cfg *config.Config, injected *redis.Client, mgr *lifecycle.Manager) (*redis.Client, error) {
    if injected != nil {
        return injected, nil
    }
    rdb, err := redisx.New(cfg.Redis)
    if err != nil {
        return nil, err
    }
    mgr.AddStopper("redis", lifecycle.StopFunc(func() {
        if err := rdb.Close(); err != nil {
            slog.Warn("close redis", "error", err)
        }
    }))
    return rdb, nil
}

// Start starts all registered components.
func (s *Service) Start() error { return s.mgr.Start() }

// Stop stops all components in reverse order.
func (s *Service) Stop() error { return s.mgr.Stop() }

// Ping is the health-check facade.
func (s *Service) Ping(ctx context.Context, req *emptypb.Empty) (*testkitv1.PingResponse, error) {
    return &testkitv1.PingResponse{
        Service: "testkit-service",
        Version: version.Get().Version,
    }, nil
}

// --- accessors for handler/server ---

// UserHandler exposes the embedded user-service (for auth domain + interceptor).
func (s *Service) UserHandler() *user.Handler { return s.user }
```

> **结构式类型说明**：`gidAdapter`/`msgAdapter` 靠 Go 结构式类型同时满足各服务 `thirdcall.GIDService`/`MessageService`（形状相同、不同 Go 类型），无需显式 implements——传给 `usrOption.WithGIDService(gidAdapter)` 等时编译器自动校验。`mgr` 暂未注册下游 handler 的 Stop（它们由 testkit 进程生命周期托管，随进程退出）。

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/...
```

Expected: PASS（可能需要调整测试里的 cfg 最小下游 config，使其能 `NewModule`）。

- [ ] **Step 5: Commit**

```bash
git add internal/service/
git commit -m "feat(service): construct four downstream modules with shared db/redis + lifecycle"
```

---

## Task 9: cmd/server/migrate.go 统一迁移

**Files:**
- Modify: `cmd/server/migrate.go`
- Modify: `cmd/server/migrate_test.go`

- [ ] **Step 1: 写 migrate 测试（三服务表都建出来）**

`cmd/server/migrate_test.go`：

```go
package main

import (
    "testing"

    "github.com/servekit/go-common/dbx"
    "github.com/stretchr/testify/require"
)

func TestRunMigration_CreatesAllTables(t *testing.T) {
    db := dbx.SetupTestDB(t)
    require.NoError(t, runMigration(db))

    // Spot-check one table per service.
    tables, err := db.Raw(`
        SELECT tablename FROM pg_tables WHERE schemaname='public'
        AND tablename IN ('users','storage_files','message_email_records')
    `).Rows()
    require.NoError(t, err)
    count := 0
    for tables.Next() { count++ }
    require.Equal(t, 3, count, "expected tables from user/storage/message")
}
```

> 注：实际表名以各服务 model 为准（user 表可能叫 `users`、storage 叫 `storage_files` 等）。实现时按真实表名调整断言。

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./cmd/server/...
```

Expected: FAIL（runMigration 还是 scaffold 版）。

- [ ] **Step 3: 重写 migrate.go**

`cmd/server/migrate.go`：

```go
package main

import (
    "fmt"

    "github.com/servekit/go-common/dbx"
    "github.com/servekit/go-common/logging"

    messageservice "github.com/servekit/message-service/pkg"
    storageservice "github.com/servekit/storage-service/pkg"
    userservice "github.com/servekit/user-service/pkg"
    "github.com/servekit/testkit-service/pkg/config"

    "gorm.io/gorm"
)

// runMigrate loads config and runs migration.
func runMigrate() error {
    cfg, err := config.Load()
    if err != nil {
        return fmt.Errorf("load config: %w", err)
    }
    logging.Setup(cfg.Log)
    db, err := dbx.New(cfg.Database)
    if err != nil {
        return fmt.Errorf("init database: %w", err)
    }
    return runMigration(db)
}

// runMigration migrates all embedded services' tables on the shared db.
// gid-service has no DB and is skipped.
func runMigration(db *gorm.DB) error {
    for _, m := range []func(*gorm.DB) error{
        userservice.Migrate,
        storageservice.Migrate,
        messageservice.Migrate,
    } {
        if err := m(db); err != nil {
            return fmt.Errorf("migrate: %w", err)
        }
    }
    return nil
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./cmd/server/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add cmd/server/
git commit -m "feat(migrate): unified in-process migration via three pkg.Migrate"
```

---

## Task 10: internal/jwt 签发/校验

**Files:**
- Create: `internal/jwt/jwt.go`
- Create: `internal/jwt/jwt_test.go`

- [ ] **Step 1: 写 jwt 测试**

`internal/jwt/jwt_test.go`：

```go
package jwt_test

import (
    "testing"
    "time"

    "github.com/servekit/testkit-service/internal/jwt"
    "github.com/stretchr/testify/require"
)

func TestSignAndVerify_RoundTrip(t *testing.T) {
    m, err := jwt.NewManager("super-secret", time.Hour)
    require.NoError(t, err)

    tok, err := m.Sign("sess-123")
    require.NoError(t, err)
    require.NotEmpty(t, tok)

    sid, err := m.Verify(tok)
    require.NoError(t, err)
    require.Equal(t, "sess-123", sid)
}

func TestVerify_Expired(t *testing.T) {
    m, _ := jwt.NewManager("k", -time.Hour) // already expired
    tok, _ := m.Sign("sess-x")
    _, err := m.Verify(tok)
    require.Error(t, err)
}

func TestVerify_BadSignature(t *testing.T) {
    m1, _ := jwt.NewManager("key1", time.Hour)
    m2, _ := jwt.NewManager("key2", time.Hour)
    tok, _ := m1.Sign("s")
    _, err := m2.Verify(tok)
    require.Error(t, err)
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/jwt/...
```

Expected: FAIL（包不存在）。

- [ ] **Step 3: 写 jwt.go**

`internal/jwt/jwt.go`：

```go
// Package jwt issues and verifies HS256 tokens carrying a session_id.
package jwt

import (
    "fmt"
    "time"

    "github.com/golang-jwt/jwt/v5"
)

// sessionKey is the custom claim key holding the user-service session id.
const sessionKey = "sid"

// Manager signs and verifies tokens.
type Manager struct {
    secret []byte
    ttl    time.Duration
}

// NewManager constructs a Manager.
func NewManager(secret string, ttl time.Duration) (*Manager, error) {
    if secret == "" {
        return nil, fmt.Errorf("jwt secret is empty")
    }
    return &Manager{secret: []byte(secret), ttl: ttl}, nil
}

// claims is the registered + custom claim set.
type claims struct {
    SessionID string `json:"sid"`
    jwt.RegisteredClaims
}

// Sign issues a token for the given session id.
func (m *Manager) Sign(sessionID string) (string, error) {
    now := time.Now()
    c := claims{
        SessionID: sessionID,
        RegisteredClaims: jwt.RegisteredClaims{
            IssuedAt:  jwt.NewNumericDate(now),
            ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
        },
    }
    tok := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
    return tok.SignedString(m.secret)
}

// Verify validates the token and returns the session id.
func (m *Manager) Verify(token string) (string, error) {
    var c claims
    _, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
        if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
        }
        return m.secret, nil
    })
    if err != nil {
        return "", fmt.Errorf("verify jwt: %w", err)
    }
    return c.SessionID, nil
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/jwt/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/jwt/
git commit -m "feat(jwt): HS256 sign/verify with session_id claim"
```

---

## Task 11: pkg/auth AuthInterceptor + 白名单 + ctx 注入

**Files:**
- Create: `pkg/auth/interceptor.go`
- Create: `pkg/auth/interceptor_test.go`

- [ ] **Step 1: 写 interceptor 测试**

`pkg/auth/interceptor_test.go`：

```go
package auth_test

import (
    "context"
    "testing"
    "time"

    "github.com/servekit/go-common/grpcx"
    "github.com/servekit/testkit-service/internal/jwt"
    "github.com/servekit/testkit-service/pkg/auth"
    "github.com/stretchr/testify/require"
    "google.golang.org/grpc"
    "google.golang.org/grpc/metadata"
)

// stubUserSvc resolves session_id → user_id without a real user-service.
type stubUserSvc struct{ id int64 }

func (s *stubUserSvc) GetUserIDBySession(ctx context.Context, sessionID string) (int64, error) {
    if sessionID == "valid" {
        return s.id, nil
    }
    return 0, auth.ErrSessionInvalid
}

func TestInterceptor_ValidToken_InjectsUserID(t *testing.T) {
    m, _ := jwt.NewManager("k", time.Hour)
    tok, _ := m.Sign("valid")
    ic := auth.NewInterceptor(m, &stubUserSvc{id: 7}, auth.WithPublicMethods("/testkit.v1.TestKitService/Ping"))

    ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("authorization", "Bearer "+tok))
    var gotUserID int64
    handler := func(ctx context.Context, req any) (any, error) {
        uid, err := grpcx.GetUserIDFromCtx(ctx)
        require.NoError(t, err)
        gotUserID = uid
        return "ok", nil
    }
    info := &grpc.UnaryServerInfo{FullMethod: "/testkit.v1.TestKitService/Protected"}
    _, err := ic(ctx, nil, info, handler)
    require.NoError(t, err)
    require.Equal(t, int64(7), gotUserID)
}

func TestInterceptor_PublicMethod_PassesWithoutToken(t *testing.T) {
    m, _ := jwt.NewManager("k", time.Hour)
    ic := auth.NewInterceptor(m, &stubUserSvc{}, auth.WithPublicMethods("/testkit.v1.TestKitService/Ping"))
    info := &grpc.UnaryServerInfo{FullMethod: "/testkit.v1.TestKitService/Ping"}
    resp, err := ic(context.Background(), nil, info, func(ctx context.Context, req any) (any, error) {
        return "pong", nil
    })
    require.NoError(t, err)
    require.Equal(t, "pong", resp)
}

func TestInterceptor_NoToken_Protected_Rejects(t *testing.T) {
    m, _ := jwt.NewManager("k", time.Hour)
    ic := auth.NewInterceptor(m, &stubUserSvc{}, auth.WithPublicMethods("/testkit.v1.TestKitService/Ping"))
    info := &grpc.UnaryServerInfo{FullMethod: "/testkit.v1.TestKitService/Protected"}
    _, err := ic(context.Background(), nil, info, nil)
    require.Error(t, err)
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./pkg/auth/...
```

Expected: FAIL（包不存在）。

- [ ] **Step 3: 写 interceptor.go**

`pkg/auth/interceptor.go`：

```go
// Package auth provides the JWT → session → user_id interceptor.
package auth

import (
    "context"
    "errors"
    "strings"

    "github.com/servekit/go-common/grpcx"
    "github.com/servekit/go-common/xerr"
    "github.com/servekit/testkit-service/internal/jwt"
    "google.golang.org/grpc"
)

// ErrSessionInvalid is returned when a session cannot be resolved.
var ErrSessionInvalid = xerr.New("session_invalid", xerr.CategoryUnauthorized, 401, "session is invalid or expired")

// UserResolver maps a session_id to a user_id (backed by user-service GetSession).
type UserResolver interface {
    GetUserIDBySession(ctx context.Context, sessionID string) (int64, error)
}

// Interceptor validates JWT and injects user_id into ctx.
type Interceptor struct {
    jwt          *jwt.Manager
    resolver     UserResolver
    public       map[string]struct{}
}

// Option configures an Interceptor.
type Option func(*Interceptor)

// WithPublicMethods marks RPC full-methods that skip auth.
func WithPublicMethods(methods ...string) Option {
    return func(i *Interceptor) {
        for _, m := range methods {
            i.public[m] = struct{}{}
        }
    }
}

// NewInterceptor constructs the auth interceptor.
func NewInterceptor(j *jwt.Manager, r UserResolver, opts ...Option) *Interceptor {
    i := &Interceptor{jwt: j, resolver: r, public: map[string]struct{}{}}
    for _, o := range opts {
        o(i)
    }
    return i
}

// Unary returns the grpc.UnaryServerInterceptor.
func (i *Interceptor) Unary() grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
        if _, ok := i.public[info.FullMethod]; ok {
            return handler(ctx, req)
        }

        token, err := grpcx.BearerTokenFromCtx(ctx)
        if err != nil || strings.TrimSpace(token) == "" {
            return nil, ErrSessionInvalid.New()
        }
        sessionID, err := i.jwt.Verify(token)
        if err != nil {
            return nil, ErrSessionInvalid.New()
        }
        userID, err := i.resolver.GetUserIDBySession(ctx, sessionID)
        if err != nil {
            return nil, err
        }
        ctx = context.WithValue(ctx, grpcx.UserIDKey, userID)
        return handler(ctx, req)
    }
}
```

> 注：`xerr.New(reason, category, httpCode, message)` 的参数顺序以 go-common `xerr` 为准（已核对 `go-common/xerr`：签名为 `New(reason, category, httpCode, message)`）。鉴权类错误用 `xerr.CategoryUnauthorized`（**已核对**：go-common 只有 `CategoryUnauthorized`，**无** `CategoryUnauthenticated`；401→gRPC `Unauthenticated` 由 grpcx 拦截器映射，见 `go-common/grpcx/interceptor.go`）。也可直接复用预置 `xcodes.ErrUnauthorized`。

- [ ] **Step 4: 实现 UserResolver 适配器（桥接 user handler）**

在同一包加 `resolver.go`：

```go
package auth

import (
    "context"

    userv1 "github.com/servekit/user-service/gen/user/v1"
    "github.com/servekit/testkit-service/internal/thirdcall/user"
)

// userResolver adapts the embedded user handler to auth.UserResolver.
type userResolver struct{ hdl *user.Handler }

// NewUserResolver wraps a user handler.
func NewUserResolver(hdl *user.Handler) UserResolver { return &userResolver{hdl: hdl} }

func (r *userResolver) GetUserIDBySession(ctx context.Context, sessionID string) (int64, error) {
    resp, err := r.hdl.GetSession(ctx, &userv1.GetSessionRequest{SessionId: sessionID})
    if err != nil {
        return 0, err
    }
    return resp.GetUserId(), nil
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
go test ./pkg/auth/...
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add pkg/auth/
git commit -m "feat(auth): JWT interceptor with session→user_id resolution + public whitelist"
```

---

## Task 12: proto TestKitService auth 子集（自定义 message）+ make proto

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`

- [ ] **Step 1: 扩展 proto（auth RPC + 自定义 message）**

`api/proto/testkit/v1/testkit.proto`（追加到 Task 2 的 proto）：

```proto
syntax = "proto3";

package testkit.v1;

import "google/api/annotations.proto";
import "google/protobuf/empty.proto";
import "buf/validate/proto/validate.proto";

message PingResponse {
  string service = 1;
  string version = 2;
}

// ---- Auth (P1) ----
// Enums mirror user-service (api/proto/user/v1/user.proto) name-for-name and
// number-for-number, so testkit↔userv1 conversion is a plain int cast
// (userv1.LoginMethod(req.GetMethod())). Re-defining them here (not importing)
// keeps testkit.proto self-contained (v2 §3.1) and gives the frontend real
// enum types in the generated swagger.

enum LoginMethod {
  LOGIN_METHOD_UNSPECIFIED = 0;
  LOGIN_METHOD_EMAIL_PASSWORD = 1;
  LOGIN_METHOD_PHONE_PASSWORD = 2;
  LOGIN_METHOD_PHONE_CODE = 3;
  LOGIN_METHOD_EMAIL_CODE = 4;
  LOGIN_METHOD_USERNAME_PASSWORD = 5;
}

enum IdentityProvider {
  IDENTITY_PROVIDER_UNSPECIFIED = 0;
  IDENTITY_PROVIDER_EMAIL = 1;
  IDENTITY_PROVIDER_PHONE = 2;
  IDENTITY_PROVIDER_GITHUB = 3;
  IDENTITY_PROVIDER_GOOGLE = 4;
  IDENTITY_PROVIDER_WECHAT = 5;
  IDENTITY_PROVIDER_APPLE = 6;
  IDENTITY_PROVIDER_WECHAT_MINIPROGRAM = 7;
  IDENTITY_PROVIDER_ADMIN = 8; // audit tag for CreateUser; not a login method (mirror user-service)
}

enum VerificationChannel {
  VERIFICATION_CHANNEL_UNSPECIFIED = 0;
  VERIFICATION_CHANNEL_EMAIL = 1;
  VERIFICATION_CHANNEL_SMS = 2;
}

enum VerificationPurpose {
  VERIFICATION_PURPOSE_UNSPECIFIED = 0;
  VERIFICATION_PURPOSE_REGISTER = 1;
  VERIFICATION_PURPOSE_LOGIN = 2;
  VERIFICATION_PURPOSE_VERIFY_EMAIL = 3;
  VERIFICATION_PURPOSE_VERIFY_PHONE = 4;
  VERIFICATION_PURPOSE_PASSWORD_RESET = 5;
  VERIFICATION_PURPOSE_BIND = 6;
}

message LoginRequest {
  LoginMethod method = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  string username  = 2 [(buf.validate.field).string.max_len = 256];
  string password  = 3 [(buf.validate.field).string.max_len = 128];
  string code      = 4 [(buf.validate.field).string.max_len = 16];
  string email     = 5 [(buf.validate.field).string.max_len = 256];
  string region_code = 6 [(buf.validate.field).string.pattern = "^[A-Z]{2}$"];
  string phone     = 7 [(buf.validate.field).string.max_len = 20];
  string captcha_id = 8 [(buf.validate.field).string.max_len = 128];
}

// UserType mirrors user-service (NORMAL=external end user, INTERNAL=platform staff).
// Drives the two-track frontend (Task 17 access.ts): INTERNAL → 内部后台管理页,
// NORMAL → 普通用户后端页。本期仅前端路由/菜单区分，后端不做鉴权（见 v2 §3.5）。
enum UserType {
  USER_TYPE_UNSPECIFIED = 0;
  USER_TYPE_NORMAL = 1;
  USER_TYPE_INTERNAL = 2;
}

message User {
  int64  id         = 1;
  string username   = 2;
  string email      = 3;
  string phone      = 4;
  string nickname   = 5;
  UserType user_type = 6 [(buf.validate.field).enum.defined_only = true];
}

message LoginResponse {
  User   user       = 1;
  bool   is_new     = 2;
  // session_id is NOT in the response — it lives only in the JWT issued by testkit.
}

message RegisterRequest {
  IdentityProvider provider = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  string email       = 2 [(buf.validate.field).string.max_len = 256];
  string code        = 3 [(buf.validate.field).string.min_len = 1];
  string username    = 4 [(buf.validate.field).string.max_len = 64];
  string nickname    = 5 [(buf.validate.field).string.max_len = 64];
  string password    = 6 [(buf.validate.field).string.max_len = 128];
  string region_code = 7 [(buf.validate.field).string.pattern = "^[A-Z]{2}$"];
  string phone       = 8 [(buf.validate.field).string.max_len = 20];
  string captcha_id  = 9 [(buf.validate.field).string.max_len = 128];
}

message RegisterResponse {
  User user = 1;
}

message SendVerificationCodeRequest {
  string email      = 1 [(buf.validate.field).string.max_len = 256];
  VerificationChannel channel = 2 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  VerificationPurpose purpose = 3 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  string region_code = 4 [(buf.validate.field).string.pattern = "^[A-Z]{2}$"];
  string phone      = 5 [(buf.validate.field).string.max_len = 20];
  string sender_id  = 6 [(buf.validate.field).string.min_len = 1];
}

message SendVerificationCodeResponse {
  string captcha_id = 1;
}

message TokenResponse {
  string token      = 1;
  User   user       = 2;
}

message RefreshSessionRequest {
  string session_id = 1 [(buf.validate.field).string.min_len = 1];
}

service TestKitService {
  rpc Ping(google.protobuf.Empty) returns (PingResponse) {
    option (google.api.http) = { get: "/api/v1/health" };
  }

  rpc Login(LoginRequest) returns (TokenResponse) {
    option (google.api.http) = {
      post: "/api/v1/auth/login"
      body: "*"
    };
  }

  rpc Register(RegisterRequest) returns (TokenResponse) {
    option (google.api.http) = {
      post: "/api/v1/auth/register"
      body: "*"
    };
  }

  rpc SendVerificationCode(SendVerificationCodeRequest) returns (SendVerificationCodeResponse) {
    option (google.api.http) = {
      post: "/api/v1/captcha/send"
      body: "*"
    };
  }

  rpc Logout(google.protobuf.Empty) returns (google.protobuf.Empty) {
    option (google.api.http) = { post: "/api/v1/auth/logout" };
  }

  rpc RefreshSession(RefreshSessionRequest) returns (TokenResponse) {
    option (google.api.http) = {
      post: "/api/v1/auth/refresh"
      body: "*"
    };
  }
}
```

> 注：testkit 的 `LoginResponse` 是 `TokenResponse{token, user}`——session_id 不回前端（只在 JWT 里）。前端拿 token 存内存。

- [ ] **Step 2: 重生成**

```bash
make proto
```

Expected: `gen/testkit/v1/` 含全部新 message + RPC。

- [ ] **Step 3: 验证编译**

```bash
go build ./...
```

Expected: FAIL（handler/service 还没实现新 RPC — 下个 Task 补）。此步仅确认 proto 生成成功。

- [ ] **Step 4: Commit**

```bash
git add api/proto/ gen/
git commit -m "feat(proto): add P1 auth RPCs with custom DTOs"
```

---

## Task 13: internal/service/auth 域（转发 + JWT 签发）

**Files:**
- Create: `internal/service/auth/auth.go`
- Create: `internal/service/auth/auth_test.go`

- [ ] **Step 1: 写 auth service 测试（Login 转发 + 签 JWT）**

`internal/service/auth/auth_test.go`：

```go
package auth_test

import (
    "context"
    "testing"
    "time"

    "github.com/servekit/testkit-service/internal/jwt"
    "github.com/servekit/testkit-service/internal/service/auth"
    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    "github.com/stretchr/testify/require"
)

func TestLogin_SignsJWT(t *testing.T) {
    m, _ := jwt.NewManager("k", time.Hour)
    // stubUserClient replaces the real user handler in tests.
    svc := auth.New(m, auth.WithUserClient(stubUser{}))
    resp, err := svc.Login(context.Background(), &testkitv1.LoginRequest{
        Method: testkitv1.LoginMethod_LOGIN_METHOD_USERNAME_PASSWORD, Username: "alice", Password: "pw",
    })
    require.NoError(t, err)
    require.NotEmpty(t, resp.GetToken())
    sid, err := m.Verify(resp.GetToken())
    require.NoError(t, err)
    require.Equal(t, "sess-1", sid)
}
```

> 注：`stubUser` 实现 auth 需要的 user 调用接口（Login 返回 session_id=user1, is_new=false）。生产里用 `*user.Handler`。

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/auth/...
```

Expected: FAIL。

- [ ] **Step 3: 写 auth.go**

`internal/service/auth/auth.go`：

```go
// Package auth implements testkit's auth domain: forward to user-service + issue JWT.
package auth

import (
    "context"
    "fmt"

    "github.com/servekit/testkit-service/internal/jwt"
    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    userv1 "github.com/servekit/user-service/gen/user/v1"
    "google.golang.org/protobuf/types/known/emptypb"
)

// UserClient is the subset of the embedded user handler auth uses.
type UserClient interface {
    Login(ctx context.Context, req *userv1.LoginRequest) (*userv1.LoginResponse, error)
    Register(ctx context.Context, req *userv1.RegisterRequest) (*userv1.RegisterResponse, error)
    SendVerificationCode(ctx context.Context, req *userv1.SendVerificationCodeRequest) (*userv1.SendVerificationCodeResponse, error)
    Logout(ctx context.Context, req *userv1.LogoutRequest) (*emptypb.Empty, error)
    RefreshSession(ctx context.Context, req *userv1.RefreshSessionRequest) (*emptypb.Empty, error)
}

// Service implements the auth domain.
type Service struct {
    jwt  *jwt.Manager
    user UserClient
}

// Option configures Service.
type Option func(*Service)

// WithUserClient injects a user client (for tests).
func WithUserClient(c UserClient) Option { return func(s *Service) { s.user = c } }

// New constructs the auth service.
func New(j *jwt.Manager, opts ...Option) *Service {
    s := &Service{jwt: j}
    for _, o := range opts {
        o(s)
    }
    return s
}

// Login forwards to user-service and issues a JWT carrying the session id.
func (s *Service) Login(ctx context.Context, req *testkitv1.LoginRequest) (*testkitv1.TokenResponse, error) {
    resp, err := s.user.Login(ctx, toUserLoginRequest(req))
    if err != nil {
        return nil, err
    }
    token, err := s.jwt.Sign(resp.GetSessionId())
    if err != nil {
        return nil, fmt.Errorf("sign jwt: %w", err)
    }
    return &testkitv1.TokenResponse{
        Token: token,
        User:  toTestkitUser(resp.GetUser()),
    }, nil
}

// Register forwards to user-service and issues a JWT.
func (s *Service) Register(ctx context.Context, req *testkitv1.RegisterRequest) (*testkitv1.TokenResponse, error) {
    resp, err := s.user.Register(ctx, toUserRegisterRequest(req))
    if err != nil {
        return nil, err
    }
    token, err := s.jwt.Sign(resp.GetSessionId())
    if err != nil {
        return nil, fmt.Errorf("sign jwt: %w", err)
    }
    return &testkitv1.TokenResponse{Token: token, User: toTestkitUser(resp.GetUser())}, nil
}

// SendVerificationCode forwards to user-service.
func (s *Service) SendVerificationCode(ctx context.Context, req *testkitv1.SendVerificationCodeRequest) (*testkitv1.SendVerificationCodeResponse, error) {
    resp, err := s.user.SendVerificationCode(ctx, toUserCodeRequest(req))
    if err != nil {
        return nil, err
    }
    return &testkitv1.SendVerificationCodeResponse{CaptchaId: resp.GetCaptchaId()}, nil
}

// Logout revokes the current session. session_id comes from the JWT in ctx.
func (s *Service) Logout(ctx context.Context, sessionID string) (*emptypb.Empty, error) {
    return s.user.Logout(ctx, &userv1.LogoutRequest{SessionId: sessionID})
}

// RefreshSession refreshes and re-issues a JWT.
func (s *Service) RefreshSession(ctx context.Context, req *testkitv1.RefreshSessionRequest) (*testkitv1.TokenResponse, error) {
    if _, err := s.user.RefreshSession(ctx, &userv1.RefreshSessionRequest{SessionId: req.GetSessionId()}); err != nil {
        return nil, err
    }
    token, err := s.jwt.Sign(req.GetSessionId())
    if err != nil {
        return nil, fmt.Errorf("sign jwt: %w", err)
    }
    return &testkitv1.TokenResponse{Token: token}, nil
}

// --- converters (testkit DTO ↔ user-service proto) ---

func toUserLoginRequest(r *testkitv1.LoginRequest) *userv1.LoginRequest {
    return &userv1.LoginRequest{
        Method:     userv1.LoginMethod(r.GetMethod()),
        Username:   r.GetUsername(),
        Password:   r.GetPassword(),
        Code:       r.GetCode(),
        Email:      r.GetEmail(),
        RegionCode: r.GetRegionCode(),
        Phone:      r.GetPhone(),
        CaptchaId:  r.GetCaptchaId(),
    }
}

func toUserRegisterRequest(r *testkitv1.RegisterRequest) *userv1.RegisterRequest {
    return &userv1.RegisterRequest{
        Provider:   userv1.IdentityProvider(r.GetProvider()),
        Email:      r.GetEmail(),
        Code:       r.GetCode(),
        Username:   r.GetUsername(),
        Nickname:   r.GetNickname(),
        Password:   r.GetPassword(),
        RegionCode: r.GetRegionCode(),
        Phone:      r.GetPhone(),
        CaptchaId:  r.GetCaptchaId(),
    }
}

func toUserCodeRequest(r *testkitv1.SendVerificationCodeRequest) *userv1.SendVerificationCodeRequest {
    return &userv1.SendVerificationCodeRequest{
        Email:      r.GetEmail(),
        Channel:    userv1.VerificationChannel(r.GetChannel()),
        Purpose:    userv1.VerificationPurpose(r.GetPurpose()),
        RegionCode: r.GetRegionCode(),
        Phone:      r.GetPhone(),
        SenderId:   r.GetSenderId(),
    }
}

func toTestkitUser(u *userv1.User) *testkitv1.User {
    if u == nil {
        return nil
    }
    return &testkitv1.User{
        Id:       u.GetId(),
        Username: u.GetUsername(),
        Email:    u.GetEmail(),
        Phone:    u.GetPhone(),
        Nickname: u.GetNickname(),
        UserType: testkitv1.UserType(u.GetUserType()),
    }
}
```

> 注：枚举用整型直转 `userv1.LoginMethod(r.GetMethod())`——testkit 的 enum 镜像 user-service 同名同号（见 Task 12 enum 块），故 int32 值一致、直接 cast 即可，无需 string→int32 map 查表。下游字段名以真实 proto 为准（实现时核对 userv1 字段名）。

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/auth/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/service/auth/
git commit -m "feat(auth): forward to user-service + issue JWT"
```

---

## Task 14: pkg/handler + service.go facade 接入 auth

**Files:**
- Modify: `pkg/handler/testkit.go`
- Modify: `internal/service/service.go`

- [ ] **Step 1: service.go 持有 auth 子服务 + facade**

在 `internal/service/service.go` 的 `Service` struct 加 `auth *auth.Service`，`New` 里构造（用 user handler 作 UserClient），加 facade 方法：

```go
// in Service struct
auth *auth.Service

// in New(), after user handler built:
authSvc := auth.New(jwtMgr, auth.WithUserClient(s.user))
s.auth = authSvc

// facade methods
func (s *Service) Auth() *auth.Service { return s.auth }
```

> 注：`jwtMgr` 在 service.New 里用 `jwt.NewManager(cfg.JWT.Secret, cfg.JWT.TTL)` 构造。handler 从 ctx 取 session_id 给 Logout（见 Step 2）。

- [ ] **Step 2: handler 实现 TestKitService RPC（薄壳）**

`pkg/handler/testkit.go`（追加 auth RPC 委托）：

```go
// Logout reads session_id from the JWT in ctx (set by auth interceptor via a
// session-id ctx key) — or testkit re-derives it. For P1, the frontend sends
// the refresh/logout using the token; testkit decodes session_id server-side.
func (h *Handler) Login(ctx context.Context, req *testkitv1.LoginRequest) (*testkitv1.TokenResponse, error) {
    return h.svc.Auth().Login(ctx, req)
}

func (h *Handler) Register(ctx context.Context, req *testkitv1.RegisterRequest) (*testkitv1.TokenResponse, error) {
    return h.svc.Auth().Register(ctx, req)
}

func (h *Handler) SendVerificationCode(ctx context.Context, req *testkitv1.SendVerificationCodeRequest) (*testkitv1.SendVerificationCodeResponse, error) {
    return h.svc.Auth().SendVerificationCode(ctx, req)
}

func (h *Handler) Logout(ctx context.Context, req *emptypb.Empty) (*emptypb.Empty, error) {
    sessionID, err := h.svc.SessionIDFromCtx(ctx) // helper: decode JWT in ctx → session_id
    if err != nil {
        return nil, err
    }
    return h.svc.Auth().Logout(ctx, sessionID)
}

func (h *Handler) RefreshSession(ctx context.Context, req *testkitv1.RefreshSessionRequest) (*testkitv1.TokenResponse, error) {
    if req.GetSessionId() == "" {
        // allow deriving from the caller's JWT if not provided
        sid, err := h.svc.SessionIDFromCtx(ctx)
        if err == nil {
            req.SessionId = sid
        }
    }
    return h.svc.Auth().RefreshSession(ctx, req)
}
```

> 注：`SessionIDFromCtx` 需要 interceptor 在注入 user_id 的同时也把 session_id 注入 ctx（在 Task 11 interceptor 里加一行 `ctx = context.WithValue(ctx, sessionIDKey, sessionID)`）。实现 Task 14 时回到 Task 11 补这个 ctx key + helper。

- [ ] **Step 3: 回到 Task 11 interceptor 补 session_id 注入**

在 `pkg/auth/interceptor.go` 的 `Unary()` 里，验 JWT 后：

```go
ctx = context.WithValue(ctx, grpcx.UserIDKey, userID)
ctx = context.WithValue(ctx, SessionIDKey, sessionID) // add this
```

并定义 `SessionIDKey` + 导出 helper `SessionIDFromCtx(ctx)(string, error)`。service.go 的 `SessionIDFromCtx` 委托给它。

- [ ] **Step 4: 验证构建 + 测试**

```bash
go build ./...
go test ./...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(handler): wire auth RPCs through service facade"
```

---

## Task 15: pkg/server.go 装配 grpcx.New + AuthInterceptor

**Files:**
- Modify: `pkg/server.go`
- Modify: `cmd/server/main.go`

- [ ] **Step 1: server.go 装配拦截器链**

`pkg/server.go`（在 `NewServer` 里）：

```go
jwtMgr, err := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.TTL)
if err != nil {
    return nil, err
}

authIntercept := auth.NewInterceptor(
    jwtMgr,
    auth.NewUserResolver(svc.UserHandler()),
    auth.WithPublicMethods(
        "/testkit.v1.TestKitService/Ping",
        "/testkit.v1.TestKitService/Login",
        "/testkit.v1.TestKitService/Register",
        "/testkit.v1.TestKitService/SendVerificationCode",
    ),
)

grpcSrv := grpcx.New(
    &grpcx.ServerConfig{
        GRPCAddr:    cfg.Server.GRPCAddr,
        GatewayAddr: cfg.Server.GatewayAddr,
    },
    func(s *grpc.Server) { testkitv1.RegisterTestKitServiceServer(s, hdl) },
    testkitv1.RegisterTestKitServiceHandlerFromEndpoint,
    grpcx.LoggingInterceptor, // outermost: logs all
    authIntercept.Unary(),     // auth
    grpcx.ErrorInterceptor,    // xerr → status
    protovalidate_middleware.UnaryServerInterceptor(validator),
)
```

> 注：拦截器顺序——LoggingInterceptor 最外，auth 次之，ErrorInterceptor，protovalidate 最内（ Architecture 参考 grpcx logging.go 文档）。

- [ ] **Step 2: 确认 main.go 用 NewServer + signalx**

scaffold 的 `cmd/server/main.go` 已是 `serve`/`migrate` dispatch + `signalx.RunWithForceQuit(srv)`。确认 `runServer` 调 `pkg.NewServer(cfg)`。

- [ ] **Step 3: 本地启动验证**

```bash
cp .env.example .env
# 起 PG + Redis（用 Task 16 的 compose，或本地）
make run
```

Expected: 服务启动，gRPC :19095 + gateway :18085。

- [ ] **Step 4: curl 验证 Ping（公开）+ Login（需 PG/Redis/下游）**

```bash
curl http://localhost:18085/api/v1/health
# Expected: {"service":"testkit-service","version":"..."}
```

- [ ] **Step 5: Commit**

```bash
git add pkg/server.go cmd/server/
git commit -m "feat(server): wire auth interceptor chain into grpcx.New"
```

---

## Task 16: docker-compose（PG/Redis/testkit migrate+serve/nginx）

**Files:**
- Create: `Dockerfile`（交 golang-service-docker render.sh 或手写）
- Create: `docker-compose.yaml`
- Create: `web/Dockerfile`（前端，Task 17 用）
- Create: `web/nginx.conf`

- [ ] **Step 1: 生成标准 Dockerfile**

```bash
# 在 dev-skills 里用 golang-service-docker render.sh 产出（读取 .env.example）
# 或参考 user-service/Dockerfile 复制改造
```

`Dockerfile`（多阶段：golang:1.26-bookworm 编译 → alpine:3.24 运行时 + grpc_health_probe）：

```dockerfile
# build
FROM golang:1.26-bookworm AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/testkit ./cmd/server

# runtime
FROM alpine:3.24
RUN apk add --no-cache ca-certificates grpc-health-probe
COPY --from=builder /out/testkit /usr/local/bin/testkit
ENTRYPOINT ["testkit"]
```

- [ ] **Step 2: 写 docker-compose.yaml**

`docker-compose.yaml`：

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${DATABASE_USER}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
      POSTGRES_DB: ${DATABASE_DB_NAME}
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DATABASE_USER}"]
      interval: 2s
      timeout: 2s
      retries: 30

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  testkit-migrate:
    build: .
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    environment:
      DATABASE_HOST: postgres
      DATABASE_USER: ${DATABASE_USER}
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      DATABASE_DB_NAME: ${DATABASE_DB_NAME}
      REDIS_ADDR: redis:6379
      JWT_SECRET: ${JWT_SECRET}
    command: ["migrate"]

  testkit:
    build: .
    depends_on:
      testkit-migrate: { condition: service_completed_successfully }
    environment:
      DATABASE_HOST: postgres
      DATABASE_USER: ${DATABASE_USER}
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      DATABASE_DB_NAME: ${DATABASE_DB_NAME}
      REDIS_ADDR: redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "19095:19095"
      - "18085:18085"

  nginx:
    build: ./web
    depends_on: [testkit]
    ports: ["8080:80"]
```

- [ ] **Step 3: 起栈验证**

```bash
make docker-up   # 或 docker compose up --build -d
docker compose logs testkit | head
curl http://localhost:18085/api/v1/health
```

Expected: migrate 跑完 → testkit 起来 → health 返回 200。

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yaml
git commit -m "feat(docker): full stack compose with migrate gate + healthcheck"
```

---

## Task 17: 前端 Ant Design Pro v6 骨架 + 登录页 + nginx

**Files:**
- Create: `web/`（Pro v6 项目）
- Create: `web/Dockerfile`
- Create: `web/nginx.conf`

- [ ] **Step 1: 初始化 Ant Design Pro v6**

```bash
cd /Users/moss/code/servekit/testkit-service
mkdir web && cd web
# 用官方脚手架初始化 v6（锁定主版本）
npx create-ant-design-pro@latest .   # 选 v6 模板；交互选 TypeScript + Umi Max
```

> 注：如 `create-ant-design-pro` 交互不便，用 `npm create ant-design-pro@latest` 并指定 v6。生成后检查 `package.json` 里 antd 是 `^6`、react `^19`、umi `^4`。

**openapi 代码生成管线（v2 Delta C）**——前端只消费 testkit 自己的 swagger，请求层与类型 100% 生成、不手写：

```bash
cd /Users/moss/code/servekit/testkit-service/web
npm i -D swagger2openapi            # Swagger 2.0 → OpenAPI 3.0 转换（max openapi 引擎偏好 3.0）
# @umijs/plugin-openapi 随 Pro v6 模板自带，无需另装
```

`web/config/config.ts` 加 `openAPI` 字段（Pro v6 模板默认识别位置）：

```ts
import { join } from 'path';

export const openAPI = {
  // 转换后的 OpenAPI 3.0（见下方 npm 脚本，由 testkit.swagger.json 转出）
  schemaPath: join(__dirname, 'openapi.json'),
  requestLibPath: "import { request } from '@umijs/max'",
  mock: false,
};
```

`web/scripts/fix-int64.js`（**跨域精度修正**——proto3 JSON（grpc-gateway/protojson）把 int64 序列化成 JSON **字符串**保精度，但 openapi spec 标的是 `integer/int64`、`@umijs/openapi` 会生成 TS `number`，类型与实际值不符、雪花 ID 丢精度。这里把所有 int64 schema 改写成 `string`，让生成类型匹配线上的字符串值）：

```js
// proto3 JSON serializes int64 as a STRING (precision past 2^53); rewrite every
// int64 in the OpenAPI spec to string so @umijs/openapi emits matching TS types.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'config', 'openapi.json');
const spec = JSON.parse(fs.readFileSync(file, 'utf8'));

let changed = 0;
function visit(node) {
  if (Array.isArray(node)) { node.forEach(visit); return; }
  if (node && typeof node === 'object') {
    if (node.type === 'integer' && ['int64', 'uint64', 'sint64', 'fixed64', 'sfixed64'].includes(node.format)) {
      node.type = 'string';
      delete node.format;
      changed++;
    }
    for (const v of Object.values(node)) visit(v);
  }
}
visit(spec);
fs.writeFileSync(file, JSON.stringify(spec, null, 2));
console.log(`fix-int64: rewrote ${changed} int64 field(s) to string`);
```

`web/package.json` 加脚本（转 2.0→3.0 → **修 int64** → `max openapi` 生成）：

```json
{
  "scripts": {
    "openapi": "swagger2openapi ../api/swagger/testkit/v1/testkit.swagger.json -o config/openapi.json && node scripts/fix-int64.js && max openapi"
  }
}
```

> **所有域（P2–P6）共享这条管线**——雪花 ID（user_id/file_id/payment_id/…）生成的 TS 类型都是 `string`，与 protojson 线上值一致，无精度丢失。各域 plan 不必各自处理。

> 前置：后端先 `make proto` 产出 `testkit-service/api/swagger/testkit/v1/testkit.swagger.json`（scaffold 的 buf.gen.yaml 已自带 openapiv2 插件）。然后：

```bash
npm run openapi
```

Expected: 生成 `src/services/testkit/`（每个 RPC 一个请求函数）+ 类型（`declare namespace API`）。生成物不手改；改 proto 后重跑 `make proto` + `npm run openapi`。

> 兜底：若 `max openapi` 能直接吃 Swagger 2.0（简单 spec 有时可以），可去掉 `swagger2openapi`、`schemaPath` 直指 `../api/swagger/testkit/v1/testkit.swagger.json`。默认保留转换（v2 §5.4）。

- [ ] **Step 2: 配置请求层（Bearer token）**

修改 `web/src/request.ts`（或 Pro 默认的 request 配置）：

```ts
import { RequestConfig } from '@umijs/max';

export const request: RequestConfig = {
  baseURL: '/api',
  requestInterceptors: [
    (config) => {
      const token = localStorage.getItem('testkit_token');
      if (token) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
      return config;
    },
  ],
  errorConfig: {
    errorThrower(res) { /* throw on non-2xx */ },
    errorHandler(error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem('testkit_token');
        localStorage.removeItem('testkit_user');
        window.location.href = '/user/login';
      }
    },
  },
};
```

- [ ] **Step 3: 登录页（用生成的 service 调 /api/v1/auth/login）**

`web/src/pages/User/Login/index.tsx`（Pro 默认登录页改造）——调用上一步 `npm run openapi` 生成的 service，**不手写 fetch**：

```tsx
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { message } from 'antd';
import { history } from '@umijs/max';
import { Login as loginAPI } from '@/services/testkit'; // 生成的请求函数（operationId=Login）

export default function LoginPage() {
  return (
    <LoginForm<{ username: string; password: string }>
      onFinish={async (vals) => {
        try {
          const data = await loginAPI({
            method: 'LOGIN_METHOD_USERNAME_PASSWORD', // proto enum 值名（swagger 以名字符串表示）
            username: vals.username,
            password: vals.password,
          });
          localStorage.setItem('testkit_token', data.token);
          // 存当前用户（含 user_type），access.ts 据此区分内部/普通（见 Step 4）
          localStorage.setItem('testkit_user', JSON.stringify(data.user));
          message.success('登录成功');
          // 按 UserType 分流：INTERNAL → 内部后台管理首页，NORMAL → 普通用户后端首页
          history.push(data.user?.userType === 'USER_TYPE_INTERNAL' ? '/dashboard' : '/profile');
        } catch {
          message.error('登录失败'); // request 拦截器已处理 401 跳转
        }
      }}
    >
      <ProFormText name="username" placeholder="用户名" rules={[{ required: true }]} />
      <ProFormText.Password name="password" placeholder="密码" rules={[{ required: true }]} />
    </LoginForm>
  );
}
```

> 注：生成函数名 = operationId（`Login`，因 buf `simple_operation_ids=true`）；以 `npm run openapi` 实际产物为准（若生成小写 `login` 则相应调整 import）。`method` 用枚举值名字符串（openapiv2 以 name 表示 enum），生成的 TS 类型会给出字面量联合，按提示选。

- [ ] **Step 4: ProLayout 骨架 + 受保护路由**

`web/src/app.tsx` 配 ProLayout（侧边栏**分两组**：内部后台管理 / 普通用户后端，按 access 显隐；P2–P5 把真实菜单项填进对应组）。`web/src/access.ts` 实现**双轨 access**（基于登录返回的 `user_type`，不是 RBAC）：

```ts
import { Access } from '@umijs/max';

const USER_TYPE_INTERNAL = 'USER_TYPE_INTERNAL';

function currentUser(): API.User | undefined {
  try { return JSON.parse(localStorage.getItem('testkit_user') ?? ''); } catch { return undefined; }
}

export default function access(): Record<string, Access> {
  const u = currentUser();
  const loggedIn = !!localStorage.getItem('testkit_token') && !!u;
  return {
    canUser: loggedIn,                                  // 已登录（任意 user_type）—— 自助类页面
    canInternal: loggedIn && u?.userType === USER_TYPE_INTERNAL, // 内部账号 —— 后台管理类页面
  };
}
```

> **路由分流约定（P2–P5 遵循）**：
> - **内部后台管理类**（user admin / RBAC 管理 / storage admin / message / gid debug / dashboard）→ `access: 'canInternal'`。
> - **普通用户自助类**（profile / identity / sessions / my-files / my-quota / my-audit）→ `access: 'canUser'`（任意登录用户，含内部账号）。
> - 登录后按 `user_type` 跳首页：INTERNAL → `/dashboard`，NORMAL → `/profile`（见 Step 3）。
>
> 这是**前端路由/菜单区分（用 UserType）**，**不是 RBAC 鉴权**——后端各 admin 端点仍只做登录态 + 身份注入、不做 permission 校验（RBAC 只 CRUD，后续 OPA；见 v2 spec §3.5/§12）。登出时同步 `localStorage.removeItem('testkit_user')`（见 Step 2 errorHandler）。

- [ ] **Step 5: nginx.conf + web/Dockerfile**

`web/nginx.conf`：

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://testkit:18085/api/;
        proxy_set_header Host $host;
        proxy_set_header Authorization $http_authorization;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`web/Dockerfile`：

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

- [ ] **Step 6: 起栈 + 端到端验证**

```bash
cd /Users/moss/code/servekit/testkit-service
docker compose up --build -d
# 浏览器打开 http://localhost:8080 → 登录页
# 用预置账号登录 → 跳转工作台 → localStorage 有 testkit_token
```

Expected: 登录成功，token 存入 localStorage，后续请求带 Bearer。

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat(web): Ant Design Pro v6 skeleton + login + nginx"
```

---

## 验收检查（P1 完成时跑）

- [ ] `go build ./...` 通过
- [ ] `golangci-lint run ./...` 无 error
- [ ] `make proto && git diff --exit-code`（生成一致）
- [ ] `api/swagger/testkit/v1/testkit.swagger.json` 由 `make proto` 生成、已提交（v2 Delta B）
- [ ] testkit.proto **不 import 任何下游 proto**（`grep -n '^import' api/proto/testkit/v1/testkit.proto` 仅命中 google/buf 标准件）
- [ ] `go test -race -coverprofile=coverage.out ./...` 全绿
- [ ] 前端 `npm run openapi` 生成 `src/services/testkit/`；登录页用生成 service、**无手写 fetch**（v2 Delta C）
- [ ] `docker compose up --build -d` 全栈起来，health 200
- [ ] 浏览器登录闭环：登录拿 token → 工作台 → token 过期/登出回登录页
- [ ] 无 scaffold demo 残留（`grep -rn demo testkit-service/` 仅命中 proto 注释等合理处）

---

## 关联

**设计文档：**
- [[2026-07-29-testkit-service-design]]（v2，本计划据此修订——正式设计；自包含 proto + 映射层 + swagger + 前端 codegen）
- [[2026-07-28-testkit-service-design]]（v1，地基章节仍有效，见 v2 §6）

**后续 plan：**
- P2 用户与权限 → `docs/superpowers/plans/2026-07-29-testkit-service-p2-user-domain.md`
- P3 文件 → `docs/superpowers/plans/2026-07-29-testkit-service-p3-storage.md`
- P4 消息 → `docs/superpowers/plans/2026-07-29-testkit-service-p4-message.md`
- P5 gid+仪表盘 → `docs/superpowers/plans/2026-07-29-testkit-service-p5-gid-dashboard.md`
- P6 扩展 → `docs/superpowers/plans/2026-07-29-testkit-service-p6-extension.md`
