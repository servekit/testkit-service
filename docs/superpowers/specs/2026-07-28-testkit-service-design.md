# testkit-service 设计文档

- **日期**：2026-07-28
- **状态**：待评审
- **作者**：Claude（与 moss 协作）
- **阶段**：design / v1

---

## 1. 背景与目标

servekit 仓库现有四个 Go 微服务：`gid-service`（雪花 ID）、`message-service`（邮件 / 短信）、`storage-service`（文件存储）、`user-service`（认证 / RBAC）。它们都是 gRPC + grpc-gateway 双协议服务，但：

- **没有任何网关 / BFF / 聚合层**，所谓 gateway 全指各服务自带的 grpc-gateway 适配器；
- **没有任何前端代码**，功能只能靠 grpcurl / curl 验证，不直观；
- **四个服务自身都不挂鉴权拦截器**，裸暴露 gRPC，完全信任调用方注入 `user_id` / `Owner` 字段。

目标：新建 `testkit-service`——一个**产品级聚合平台**，把四个服务的全部能力聚合到一个前后端齐全的应用里，提供直观的操作 / 测试 / 运营界面，并为未来（支付等）新服务预留可扩展的挂载点。

**成功标准**：
- 一个 docker-compose 一键拉起全栈（PG / Redis / 4 下游 in-process / BFF / 前端 nginx）；
- 通过 Web UI 能端到端走通：登录注册 → 用户 / 权限管理 → 文件上传下载 → 邮件短信发送与记录查看 → gid 调试 → 全局仪表盘；
- 鉴权闭环安全（BFF 是唯一信任边界），改密 / 封号 / 登出即时失效；
- 后续新增服务（如支付）只需加一个 thirdcall + 一组前端页面，不动地基。

---

## 2. 核心决策

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| 1 | 定位 | 产品级聚合平台 | 鉴权 / 安全 / 分层 / 可观测性到位，可长期演进 |
| 2 | 前端 | Ant Design Pro（React + ProComponents）为主线 | 不提前抽象 UI 层；未来 shadcn 走迁移或另起前端（YAGNI） |
| 3 | 范围 | 全功能覆盖（4 服务所有面向用户的 RPC） | 分 6 期交付，控制首期 |
| 4 | 后端形态 | 方案 B：in-process embed 四服务 | 单进程、无网络、部署最简；thirdcall 保留切 grpc 的口子 |
| 5 | 服务形态 | 标准 go-common gRPC + grpc-gateway 服务 | 遵循 golang-service-development / architecture.md |
| 6 | 鉴权 | JWT（承载 session_id）+ user-service session 有状态校验 | 多端通用（web / 未来 app）；即时失效 |
| 7 | 前端托管 | nginx 独立托管 | 不用 go:embed |
| 8 | 命名 / 脚手架 | testkit-service（new-service.sh 生成） | 无连字符满足 `^[a-z][a-z0-9]*$`，一键生成全套标准件 |

---

## 3. 整体架构

单 Go 进程（BFF），内嵌四个下游服务，前端由 nginx 独立托管：

```
浏览器 (Ant Design Pro SPA)
   │  HTTP + Authorization: Bearer <jwt>
   ▼
┌──────────────────────────────────────────────────┐
│ nginx (独立容器)                                   │
│   · 托管前端构建产物                                │
│   · 反代 /api/ → testkit-service gateway          │
└──────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────┐
│ testkit-service (单 Go 进程)                       │
│                                                   │
│  grpcx server (gRPC + grpc-gateway)              │
│    拦截器链: AuthInterceptor(JWT) → ErrorInterceptor│
│             → protovalidate                        │
│  ┌─────────────────────────────────────────────┐  │
│  │ pkg/handler  (聚合 RPC 薄壳, 一行委托)         │  │
│  ├─────────────────────────────────────────────┤  │
│  │ internal/service  (service.go facade + 领域)   │  │
│  ├─────────────────────────────────────────────┤  │
│  │ internal/thirdcall (4 下游 module.go)         │  │
│  │   user / storage / message / gid (in-process) │  │
│  │   共享同一组 PG / Redis 连接池                  │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
   │
   ▼
 PostgreSQL + Redis  (+ SMTP / SMS / OSS / OAuth providers)
```

---

## 4. 目录结构

由 `new-service.sh testkit --thirdcall --redis` 生成标准骨架（遵循 `architecture.md` §1），随后按本 spec 演进：

```
testkit-service/
├── api/proto/testkit/v1/               # proto 定义（package testkit.v1）
│   └── testkit.proto                   # TestKitService（聚合 API）
├── cmd/server/                          # main.go (serve/migrate) + migrate.go
├── gen/                                 # buf 产物（committed）
├── internal/
│   ├── service/                         # service.go facade + 领域子包
│   │   ├── service.go                   # Service 本体 + New + Start/Stop + facade
│   │   ├── auth/                        # 登录/注册/登出/JWT 签发
│   │   ├── user/                        # user-service 域转发 + 编排
│   │   ├── storage/                     # storage-service 域
│   │   ├── message/                     # message-service 域
│   │   ├── gid/                         # gid-service 域
│   │   └── dashboard/                   # 跨服务聚合（仪表盘）
│   ├── thirdcall/                       # 4 下游实现（唯一 import 下游 gen 处）
│   │   ├── user/{module.go,grpc.go}
│   │   ├── storage/{module.go,grpc.go}
│   │   ├── message/{module.go,grpc.go}
│   │   └── gid/{module.go,grpc.go}
│   ├── jwt/                             # JWT 签发 / 校验（HS256）
│   └── version/
├── pkg/
│   ├── server.go                        # grpcx.New + AuthInterceptor 装配
│   ├── handler/                         # TestKitService 薄壳
│   ├── client.go                        # NewClient (gRPC)
│   ├── module.go                        # NewModule (in-process)
│   ├── config/                          # 聚合配置
│   ├── option/                          # WithDB/WithRedis + WithUser/Storage/...
│   ├── thirdcall/                       # 4 接口 + 工厂（mode=module/grpc）
│   ├── auth/                            # AuthInterceptor + 白名单 + ctx helpers
│   └── xcodes/                          # 聚合层错误码
├── buf.yaml  buf.gen.yaml               # buf v2 + managed mode + go_package_prefix
├── Makefile  Dockerfile  docker-compose.yaml  .golangci.yml
├── config.example.yaml  .env.example    # 纯结构 + ${VAR} 占位
├── go.mod  CLAUDE.md  README.md
└── web/                                 # Ant Design Pro 前端（nginx 构建源）
    └── (React 项目 + web/Dockerfile + nginx.conf)
```

**module path**：`github.com/servekit/testkit-service`
**proto package**：`testkit.v1`，`go_package = github.com/servekit/testkit-service/gen/testkit/v1;testkitv1`

---

## 5. 鉴权闭环（JWT + session）

### 5.1 设计原则

**JWT 只承载 `session_id`，不承载 `user_id`**——真正鉴权仍走 user-service session 有状态校验（Redis-only `GetSession`，滑动续期）。这样：
- 支持多端（web / 未来 app）通用 bearer token；
- 改密 / 封号 / 登出 / session 撤销能**即时失效**（避免无状态 JWT 的撤回难题）。

### 5.2 流程

```
登录  POST /api/v1/auth/login
        → handler 调 embed user-service.Login → session_id
        → internal/jwt 签发 HS256 JWT{ session_id, exp, iat }
        → 返回 { token, user }

请求  Authorization: Bearer <jwt>
        → grpc-gateway 透传 header 为 gRPC metadata（authorization）
        → AuthInterceptor (gRPC UnaryServerInterceptor):
            1. metadata 取 bearer → JWT 验签 + exp
            2. claims.session_id → user-service.GetSession → user_id
            3. user_id 注入 ctx
        → handler 从 ctx 取 user_id，填入下游请求 user_id / Owner{USER, user_id}
```

### 5.3 实现要点

- **公开 RPC 白名单**（不过 AuthInterceptor）：`Login` / `Register` / `SendVerificationCode` / `Ping` / 各服务健康检查。
- **grpc-gateway header 透传**：配置 `runtime.WithIncomingHeaderMatcher` 放行 `authorization`（默认已放行，显式声明避免踩坑）。
- **ctx 注入**：用 `grpcx` 的辅助（`BearerTokenFromCtx` / `GetUserIDFromCtx` 系列已有），BFF 定义自己的 ctx key + helper（`authctx.SetUserID` / `authctx.UserIDFrom`）。
- **JWT 库**：`github.com/golang-jwt/jwt/v5`，HS256，secret + exp 从配置读。
- **admin 端点**：叠加 RBAC permission 校验（调 user-service `rbac.GetUserPermissions`）。

---

## 6. thirdcall embed（4 下游）

### 6.1 双层结构（遵循 architecture.md §4）

- `pkg/thirdcall/{user,storage,message,gid}.go`：接口 + 工厂，`switch cfg.Mode { case "grpc": ...; case "module","": ... }`。
- `internal/thirdcall/{name}/{module.go, grpc.go}`：
  - `module.go` 调 `<svc>-service/pkg.NewModule(cfg, opts...)`；
  - `grpc.go` 调 `<svc>-service/pkg.NewClient(target)`。
- **依赖方向**：`internal/thirdcall/<name>/` 是唯一 import 下游 `gen/` 的地方；service / handler 只依赖 `pkg/thirdcall` 接口。

### 6.2 scaffold 后扩展

`--thirdcall` 生成 **1 个** thirdcall 占位（dual-mode 教学样板）。testkit-service 需要调 4 个下游，故生成后按 thirdcall 双层模式扩展为 `gid / message / storage / user` 共 4 个（照抄占位改真实，详见 `SKILL.md` §2.1）。

### 6.3 默认 mode=module + 连接共享

- 4 个 thirdcall 默认 `mode: module`（in-process embed），配置一行切 `grpc` 即转独立部署——facade 不变，为未来"切回方案 A 独立 BFF"留口子。
- test-service 启动时顺序构造 4 个 module，注册到 `lifecycle.Manager`。
- **连接共享**：testkit-service 建一组 PG / Redis 连接池（`dbx.New` / `redisx.New`），通过各服务 `option.WithDB/WithRedis` 注入 4 个 module（避免各开连接池）；JWT / 限流复用同一 Redis。

---

## 7. 配置聚合

`pkg/config/config.go` 的 `Config` 聚合：

```go
type Config struct {
    Server     *ServerConfig              // GRPC / Gateway addr
    Database   *dbx.Config                // 共享 PG
    Redis      *redisx.Config             // 共享 Redis
    JWT        *JWTConfig                 // secret / ttl
    CORS       *CORSConfig                // allowed_origins
    RateLimit  *RateLimitConfig           // 登录等敏感端点
    ThirdParty *ThirdPartyConfig          // 4 下游 RemoteServiceConfig
    Log        *logging.Config
}

type ThirdPartyConfig struct {
    GID     *RemoteServiceConfig[*gidconfig.Config]
    Message *RemoteServiceConfig[*messageconfig.Config]
    Storage *RemoteServiceConfig[*storageconfig.Config]
    User    *RemoteServiceConfig[*userconfig.Config]
}
```

`RemoteServiceConfig[T]` 沿用 user-service 已有定义（`Mode / Target / Config`）。`config.example.yaml` 纯结构 + `${VAR}`，`configx.Load(..., WithExpandEnv())`。env prefix `TESTKIT`。

---

## 8. 迁移编排

三个有表的服务（user / storage / message）都在 `pkg/handler/migrate.go` 暴露统一的 module 迁移入口 `<svc>pkg.Migrate(db *gorm.DB) error`（pkg 重新导出 `handler.Migrate`，内部 `dbx.AutoMigrate(db, models.AllModels()...)`）。gid-service 无 DB，不参与迁移。

**testkit-service 在自己进程内统一迁移**（in-process embed 的最大便利）：`cmd/server/migrate.go` 的 `runMigration` 直接 import 三个下游 pkg，对共享 parentDB 顺序调用：

```go
import (
    userservice "github.com/servekit/user-service/pkg"
    storageservice "github.com/servekit/storage-service/pkg"
    messageservice "github.com/servekit/message-service/pkg"
)

// runMigration migrates all embedded services' tables on the shared db.
// gid-service has no DB and is skipped.
func runMigration(db *gorm.DB) error {
    for _, m := range []func(*gorm.DB) error{
        userservice.Migrate,
        storageservice.Migrate,
        messageservice.Migrate,
    } {
        if err := m(db); err != nil {
            return err
        }
    }
    return nil
}
```

- 三服务都不用外键（各自 CLAUDE.md 约定，只保留 UNIQUE / 索引），表之间无跨服务依赖，迁移顺序无关。
- 遵循「迁移与发版解耦」：`testkit-service migrate` 子命令单独跑（serve 不自动迁移）；docker-compose 用 testkit-service **自身镜像**一次性跑 `migrate`，成功后再 `serve`。
- **不再需要** `migrate-deps` Makefile 目标、也不需要为每个下游起独立 migrate 容器——单进程内一次完成。
- testkit-service 自身 P1 不建表（scaffold 不传 `--db`）；若将来加自有表（审计 / 聚合），在 `runMigration` 里追加自己的 `models.AllModels()`。

---

## 9. 前端（Ant Design Pro + nginx）

### 9.1 技术栈

- **Ant Design Pro v6**（锁定主版本，不跨主版本升级到 v7）：React 19 + antd 6 + Umi Max 4 + `@ant-design/pro-components`（ProLayout / ProTable / ProForm）。用 `create-ant-design-pro` 初始化 v6 模板，`package.json` 锁定主版本号。
- 请求层：统一 `Authorization: Bearer <jwt>`，token 存内存（SPA 运行期），刷新走 `/api/v1/auth/refresh`。
- 仪表盘图表：`@ant-design/charts`（兼容 antd 6 的版本）。

### 9.2 页面结构（ProLayout 侧边栏）

```
工作台（仪表盘）
用户
  ├ 登录日志 / 用户列表（admin）
  ├ 我的资料 / 身份绑定
  ├ 会话管理
  └ RBAC（角色 / 用户组 / 权限）
文件
  ├ 我的文件 / 上传
  └ 管理（admin）/ 配额 / 审计
消息
  ├ 发邮件 / 发短信
  ├ 邮件记录 / 短信记录 / 统计
  └ sender 管理
gid 调试
  ├ 生成 ID / 批量 / 拆解
系统
  └ 健康检查 / 各服务状态
```

### 9.3 托管

- 前端源码：`testkit-service/web/`。
- 构建：`web/Dockerfile` 多阶段构建（node 构建 → nginx 运行时）。
- `nginx.conf`：托管静态产物 + `location /api/ { proxy_pass http://testkit-service:18085; }`。
- 开发期：前端 `vite` dev server 代理 `/api` 到本地 BFF gateway。

### 9.4 端口规划

| 组件 | 端口 |
|---|---|
| testkit-service gRPC | `:19095` |
| testkit-service gateway（HTTP） | `:18085` |
| 前端 nginx | `:8080`（或按需） |

（沿用现有 `:1909x` gRPC / `:1808x` gateway 序列，testkit-service 取下一个。）

---

## 10. 聚合 API 设计

testkit-service 在 proto 里定义 `TestKitService`，REST 前缀 `/api/v1/...`。两类 RPC：

- **1:1 转发型**（绝大多数）：proto `import` 4 下游 proto，**直接复用下游 message** 作为入参 / 出参（避免重复定义 ~100 个 message）；handler 从 ctx 取 `user_id` 注入请求后转发下游。例：`Login(userv1.LoginRequest) → userv1.LoginResponse`。
- **聚合型**（少数）：自定义 message，service 层用 `gorx` 并发调多个下游合并。例：`GetDashboard() → DashboardResponse`。

grpcx 拦截器链（`pkg/server.go`）：

```go
grpcx.New(
    &grpcx.ServerConfig{GRPCAddr: cfg.Server.GRPC, GatewayAddr: cfg.Server.HTTP},
    func(s *grpc.Server) { testkitv1.RegisterTestKitServiceServer(s, hdl) },
    testkitv1.RegisterTestKitServiceHandlerFromEndpoint,
    auth.Interceptor(jwtVerifier, userSvc, publicMethods),  // JWT → session → user_id
    grpcx.ErrorInterceptor,
    protovalidate_middleware.UnaryServerInterceptor(validator),
)
```

---

## 11. 完整功能清单（按服务，全功能覆盖）

> 每行 = 一个聚合 API（多数 1:1 转发下游同名 RPC）。阶段标注见 §12。

### P1 地基 + 认证闭环
| 聚合 API | 转发目标 | REST |
|---|---|---|
| Login | user.Login | `POST /api/v1/auth/login` |
| Register | user.Register | `POST /api/v1/auth/register` |
| SendVerificationCode | user.SendVerificationCode | `POST /api/v1/captcha/send` |
| Logout | user.Logout | `POST /api/v1/auth/logout` |
| RefreshSession | user.RefreshSession | `POST /api/v1/auth/refresh` |
| Ping | 各服务 Ping | `GET /api/v1/health` |

### P2 用户体系（user-service 全套）
| 域 | RPC |
|---|---|
| Profile | GetProfile / UpdateProfile / ChangePassword |
| Identity | ListIdentities / BindIdentity / BindOAuthIdentity / UnbindIdentity |
| Session | ListSessions / RevokeSession / RevokeAllSessions / GetSession / IssueSessionCode / ExchangeSessionCode |
| Social | GetOAuthURL / SocialLogin / MiniProgramLogin / MiniProgramPhoneLogin |
| Admin-Users | CreateUser / GetUser / ListUsers / ListUsersPaged / DisableUser / GetLoginLogs |
| RBAC-Group | CreateGroup / GetGroup / UpdateGroup / ListGroups / DeleteGroup / AddGroupMember / RemoveGroupMember / ListGroupMembers / AddGroupRole / RemoveGroupRole |
| RBAC-Role | CreateRole / UpdateRole / DeleteRole / ListRoles |
| RBAC-Permission | ListPermissions / ListPermissionGroups / AssignRole / RevokeRole |

### P3 文件（storage-service 全套 ~40 RPC）
| 域 | RPC |
|---|---|
| 上传 | GenerateUploadURL / GetSTSCredential / BatchGetSTSCredential / ConfirmUpload / CancelUpload |
| 下载 / 处理 | GenerateDownloadURL / GenerateProcessURL / GenerateCDNURL |
| 我的文件 | ListMyFiles / ListMyFilesPaged / GetMyFile / UpdateMyFile / DeleteMyFile / BatchDeleteMyFiles |
| 配额 / 审计 | GetMyQuota / ListMyAuditLogs |
| 业务方配额 | SetOwnerQuota / AddOwnerQuota |
| Admin | AdminListFiles / AdminGetFile / AdminDeleteFile / AdminGetQuota / AdminSetQuota / AdminGetStats / AdminListProviders / AdminListBuckets / AdminSoftDeleteOwnerFiles / AdminDeleteOwner / AdminListAuditLogs |

### P4 消息（message-service 全套 15 RPC）
| 域 | RPC |
|---|---|
| 发送 | SendEmail / SendSMS |
| 邮件记录 | GetEmail / ListEmails / ListEmailsByCursor / GetEmailStats / ListEmailSenders |
| 短信记录 | GetSMS / ListSMS / ListSMSByCursor / GetSMSStats / ListSMSRegions / ListSMSSenders |

### P5 gid 调试 + 仪表盘
| 域 | RPC |
|---|---|
| gid | NextID / BatchNextID / Decompose |
| 仪表盘（聚合） | GetDashboard = 并发 GetEmailStats + GetSMSStats + GetMyQuota + ListUsersPaged |

### P6 扩展
支付等新服务挂入（加 thirdcall + 前端页面，验证 facade 可扩展性）。

---

## 12. 分阶段交付

| 期 | 内容 | 交付物 |
|---|---|---|
| **P1** 地基 + 认证闭环 | `new-service.sh` 生成骨架 + 扩 4 thirdcall embed + JWT AuthInterceptor + 配置聚合 + 统一迁移（三服务 pkg.Migrate）+ docker-compose（含 nginx）+ 前端骨架（ProLayout + 登录页）+ auth 子集 | 可登录的空壳应用 |
| **P2** 用户与权限 | user-service 全套 UI（profile / identity / session / social / admin / RBAC） | 用户运营后台 |
| **P3** 文件 | storage-service 全套 UI（上传 / 下载 / 文件列表 / 配额 / 审计 / admin） | 文件管理台 |
| **P4** 消息 | message-service 全套 UI（发送 / 记录 / 统计 / sender） | 消息管理台 |
| **P5** gid + 仪表盘 | gid 调试面板 + 全局仪表盘 | 完整聚合平台 |
| **P6** 扩展 | 支付等新服务 | 验证可扩展性 |

每期独立可验收：proto + handler + service + 前端页面 + 端到端测试。

---

## 13. 错误处理

- 下游 `xerr.Error` 透传：grpcx `ErrorInterceptor` 把 xerr 映射为 gRPC status（含 httpCode），grpc-gateway 转对应 HTTP 码。
- testkit-service 自身错误统一用 `go-common/xcodes`（`pkg/xcodes/<domain>.go` 按域分文件）。
- 前端：Ant Design Pro 约定的统一错误处理（`request` 拦截器 + 全局 message）。
- JWT 失败 → `ErrUnauthorized`（401，前端跳登录）；session 失效 → 同 401。

---

## 14. 测试策略

- **handler / service 集成测试**：embed 真实 4 服务 + `dbx.SetupTestDB`（testcontainer PG）+ `redisx.NewTestClient`（miniredis），覆盖关键链路（登录 → 带 token 调下游）。
- **AuthInterceptor 单测**：JWT 签发 / 验签 / 过期 / 白名单。
- **thirdcall facade 单测**：module / grpc 两种 mode。
- **前端**：Ant Design Pro 默认 setup（关键页面快照 / 交互测试）。
- 每期交付时跑 `make proto && make generate && go build ./... && go test -race ./... && golangci-lint run`。

---

## 15. 安全（产品级）

- BFF 是**唯一信任边界**：所有下游 `user_id` / `Owner` 由 BFF 从 ctx 注入，前端不可直接指定。
- JWT：HS256，secret 从 env（不入 git）；合理 exp（如 2h）+ 刷新机制。
- session_id 仅存在于 JWT claims，前端只持有 JWT（不暴露给 JS 可见层）。
- CORS：严格 `allowed_origins` 白名单（生产）。
- 限流：登录 / 发送验证码 / 发消息等敏感端点用 `go-common/ratelimit`（Redis 固定窗口）。
- 审计：关键操作（admin 变更、登录）记日志（P1 起步，后续可加 BFF 自有审计表）。
- 存储类 admin / 业务配额端点：仅 BFF 内部编排可达，前端 admin 入口叠加 RBAC。

---

## 16. 非目标（P1 不做）

- BFF 自有持久化（审计 / 聚合表）——需要时按 skill §1 加 `internal/store/`。
- shadcn 双 UI 体系——未来另起或迁移。
- OAuth 真实 provider 对接——开发期 mock / 占位，需真实凭证时配置。
- 支付等服务——P6。
- 生产 k8s 部署——当前 docker-compose 优先，生产形态后续。

---

## 17. 命名与脚手架

`testkit-service` 满足 `new-service.sh` 的 `^[a-z][a-z0-9]*$` 约束，**用脚本一键生成**完整骨架（避免手写遗漏）：

```bash
# 从 servekit 根执行
./dev-skills/skills/golang-service-development/scripts/new-service.sh testkit --thirdcall --redis
```

scaffold 产出全套标准件：`Makefile` / `Dockerfile` / `docker-compose.yaml` / `buf.yaml` / `buf.gen.yaml` / `.golangci.yml` / `config.example.yaml` / `.env.example` + 目录骨架 + 1 个 thirdcall 占位 + 示例业务代码。生成后按 `architecture.md` 演进：

1. **扩 4 个 thirdcall**：scaffold 的 `--thirdcall` 占位照 `SKILL.md` §2.1 改造，扩展为 `gid / message / storage / user`（默认 `mode=module`）。
2. **删示例业务代码**：scaffold 以服务名为名的 demo 样板（`TestKit` CRUD）删除或改写为本 spec 的聚合 API（`TestKitService`）。
3. **Docker 件**：交给 `golang-service-docker` 的 `render.sh` 产出标准多阶段构建（scaffold 不自带简陋 Dockerfile）。
4. **改造 `migrate.go`**：scaffold 生成的 `cmd/server/migrate.go` 默认调自身 models；改为顺序调用 user / storage / message 的 `pkg.Migrate(db)`（gid 无 DB 跳过），实现单进程内统一迁移，详见 §8。

---

## 关联

**实现计划（待写）：**
- [[services/testkit-service/plan/v1/1-foundation|1-foundation]]（P1 地基）
- [[services/testkit-service/plan/v1/2-user-domain|2-user-domain]]（P2）
- [[services/testkit-service/plan/v1/3-storage|3-storage]]（P3）
- [[services/testkit-service/plan/v1/4-message|4-message]]（P4）
- [[services/testkit-service/plan/v1/5-gid-dashboard|5-gid-dashboard]]（P5）

**相关服务：**
- [[services/user-service|user-service]]
- [[services/storage-service|storage-service]]
- [[services/message-service|message-service]]
- [[services/gid-service|gid-service]]
