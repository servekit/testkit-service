# testkit-service 结构改造设计

- 日期：2026-07-30
- 状态：待评审
- 范围：`internal/thirdcall`、`internal/adapter`、`internal/service`（含 `init.go`）、`pkg/{thirdcall,option,module,server}`、各子域包

## 1. 背景与目标

testkit-service 是一个集成/BFF 服务，把 gid / message / storage / user 四个下游服务整包透传出去，做全量集成测试与面向前端的聚合。

当前结构偏离了 `golang-service-development` 的 thirdcall 范式（参照 user-service）：

1. `internal/adapter/` 仅为 auth 拦截器的 `SessionResolver` 桥而存在，是个一次性包。
2. 子域各自重声明本地 client 接口（`auth.UserClient`、`gid.Client`、`dashboard.{User,Storage,Message}Client`），或直接吃下游 gen server 接口（`userv1.UserServiceServer` 等）——接口归属散落，未由 thirdcall 统一定义。
3. `pkg/thirdcall/` 用「具体 handler 类型别名 + 双模工厂」做公共面，多一层冗余；且和 `internal/thirdcall/` 重复。
4. testkit 是终端服务（无被嵌入方），却保留了一整套「可嵌入 / 可注入」机制（`pkg.NewModule`、`pkg/option` 资源/handler 注入、`owns/injected` 分支），其中 `pkg.NewModule` 无任何真实调用方，`option.WithX` 在非测试代码里从未使用。

**目标**：严格对齐 user-service 的 thirdcall 范式，并新建 `init.go` 集中实例化资源与依赖注入；删除终端服务用不到的嵌入/注入机制。**保留** four 下游的 module/grpc 双模（实际会用 gRPC 方式部署子服务）。

## 2. 目标目录结构

```
internal/
  thirdcall/
    gid/      gid.go(手写接口) + module.go(包络) + grpc.go(真实拨号后端)
    message/  message.go + module.go + grpc.go
    storage/  storage.go + module.go + grpc.go
    user/     user.go + module.go + grpc.go + config.go(normalize)
  adapter/                     ❌ 整个删除
  service/
    service.go                 # Service 结构体 + Start/Stop/Ping + facade 访问器
    init.go                    # 🆕 New + resolve/build/DI + setupJobs + rollback
    auth/ user/ storage/ message/ gid/ dashboard/   # 注入 thirdcall 接口，删本地接口
pkg/
  thirdcall/                   ❌ 整个删除
  option/                      ❌ 整个删除
  module.go                    ❌ 删除（NewModule 无调用方）
  server.go                    # 瘦身：去 ServerOption；resolver 走 svc.SessionResolver()
```

## 3. thirdcall 重写（严格照搬 user-service）

### 3.1 为什么必须手写 interface（不能 embed gen 接口）

- embed gen **server** 接口：grpc 客户端没有 `mustEmbedUnimplemented*()`（仅 server 侧有）→ grpc 后端无法满足。
- embed gen **client** 接口：client 方法签名带 `opts ...grpc.CallOption`，server handler 方法不带 → handler 无法满足。

两条 embed 路都走不通，故 interface 必须手写（server 风格签名、无 `opts`），module 与 grpc 两个后端各自实现该 interface。这正是 user-service 的做法。

### 3.2 每个包的文件

`<svc>.go` —— 手写 interface（**只列 testkit 真正调用的方法** = 各子域调用方法 ∪ resolver/dashboard 用到的方法；含 `Close()`）+ 编译期断言（module/grpc 两个后端都满足）：

```go
package user
type UserService interface {
    Login(context.Context, *userv1.LoginRequest) (*userv1.LoginResponse, error)
    Register(context.Context, *userv1.RegisterRequest) (*userv1.RegisterResponse, error)
    SendVerificationCode(...) ...
    Logout(...) ...
    RefreshSession(...) ...
    GetSession(...) ...          // Service.SessionResolver() 用
    GetProfile/UpdateProfile/... ...   // user 域
    ListUsersPaged(...) ...      // dashboard 用
    // …testkit 调到的全部方法
    Close() error
}
var (
    _ UserService = (*moduleUser)(nil)
    _ UserService = (*grpcUser)(nil)
)
```

`module.go` —— 只包不建（实例由 init.go 完成）：

```go
type moduleUser struct {
    *userhandler.Handler
    owns bool
}
func NewModule(h *userhandler.Handler, owns bool) UserService {
    return &moduleUser{Handler: h, owns: owns}
}
func (m *moduleUser) Close() error {
    if !m.owns { return nil }
    return m.Handler.Stop()
}
```

`grpc.go` —— 真实 gRPC 后端，逐方法手写转发（剥掉 `opts ...grpc.CallOption`）：

```go
type grpcUser struct{ client *userservice.Client }
func NewGRPC(target string) (UserService, error) {
    c, err := userservice.NewClient(target)
    if err != nil { return nil, fmt.Errorf("dial user-service %q: %w", target, err) }
    return &grpcUser{client: c}, nil
}
func (g *grpcUser) Login(ctx context.Context, r *userv1.LoginRequest) (*userv1.LoginResponse, error) {
    return g.client.Login(ctx, r)
}
// …其余方法逐个转发
func (g *grpcUser) Close() error { return g.client.Close() }
```

四个包各自类型名：`gid.GIDService`、`message.MessageService`、`storage.StorageService`、`user.UserService`。
裸 handler 类型：`*gidservice.Handler`、`*messageservice.Handler`、`*storagehandler.Handler`、`*userhandler.Handler`。

`user/config.go`（`normalizeConfig` + dev 占位常量）保留。thirdcall/user 包到此为 4 文件（`user.go` + `module.go` + `grpc.go` + `config.go`），**不含 resolver**——session→userID 解析归 service 根（见 §6）。

### 3.3 interface 方法集来源（实现时确定）

对每个下游，方法集 = testkit 代码在该下游上实际调用的方法并集。来源：
- `internal/service/auth/auth.go`（auth 调用的 user 方法 + `GetSession`）
- `internal/service/user/user.go`（user 域调用的全部 user 方法）
- `internal/service/dashboard/dashboard.go`（`ListUsersPaged`/`GetMyQuota`/`GetEmailStats`/`GetSMSStats`）
- `internal/service/storage/storage.go`、`message/message.go`、`gid/gid.go`（各自透传方法）
- `internal/service/service.go` 的 `SessionResolver()`（`GetSession`）

实现步骤：`grep -rn "s\.<field>\." internal/service/<domain>` 枚举每个域调用的方法 → 按下游归并 → 写入对应 interface。规模量级：user ~50、storage ~29、message ~10、gid 3。

## 4. init.go（资源实例化 + 依赖注入）

`internal/service/init.go` 承接原 `service.go` 的全部构造逻辑，照 user-service 的 resolve 模式：

- `New(cfg *config.Config) (*Service, error)` —— 编排入口（失败用 `rollback(mgr, err)`）。
- `resolveRedis` / `resolveDB` —— 从 cfg 自建，`mgr.AddStopper` 注册 Stopper。
- `resolveGID(cfg) → (gid.GIDService, *gidservice.Handler, error)`：
  - grpc：`gid.NewGRPC(cfg.Target)`；`mgr.AddStopper("gid", StopFunc(gid.Close))`；裸 handler 返回 nil。
  - module：`gidservice.NewModule(cfg.Config)` 建裸 handler；`gid.NewModule(hdl, true)` 包；`mgr.AddStopper("gid", StopFunc(gid.Close))`；返回裸 handler 供下游共享。
- `resolveMessage(cfg, db, rdb, gidRaw) → (message.MessageService, *messageservice.Handler, error)`：module 时 `if gidRaw != nil { messageoption.WithGIDHandler(gidRaw) }`；返回裸 handler。
- `resolveStorage(cfg, db, rdb, gidRaw) → (storage.StorageService, error)`：共享 gidRaw。
- `resolveUser(cfg, db, rdb, gidRaw, msgRaw) → (user.UserService, error)`：共享 gidRaw + msgRaw。
- `buildDomains` —— 建 `jwt.Manager` + 六子域，把 thirdcall 接口 / jwtMgr / senderID 经各子域 `New(...opts)` 注入；`cfg.Message.SenderID` 空则 fail-fast。
- `setupJobs` / `rollback`。

**模块共享约束**：module 模式沿依赖链共享裸 handler（gid→{message,storage,user}，message→user）。若某下游是 module，其上游也必须 module（才有裸 handler 可注入）；grpc 模式独立（各自拨自己的上游）。主用例「全 module」（完整集成测试）与「全 grpc」均不受影响。

`service.go` 仅保留：`Service` 结构体、`Start()`（`mgr.Start()`）、`Stop()`（`mgr.Stop()`）、`Ping()`、facade 访问器（`Auth()/User()/Storage()/Message()/Gid()/Dashboard()/DB()/SessionResolver()`）。`SessionResolver()` 把 user-service `GetSession` 包成 `auth.SessionResolver`，供 `pkg/server` 的拦截器使用（见 §6）。

## 5. 生命周期（照 user-service）

module / grpc 两模式均 `owns=true`，统一：

```go
mgr.AddStopper("<name>", lifecycle.StopFunc(func() { _ = svc.Close() }))
```

（`lifecycle.StopFunc` 签名为 `func()`，无返回值。）`Close()`（owns=true）→ 裸 handler `Stop()`（module）或 `client.Close()`（grpc）。

**行为变更（已知）**：testkit 现状用 `mgr.Add`（会调下游 `Start()`）。改为 `AddStopper(Close)` 后不再调下游 `Start()`。当前各下游内部 cron 调度器均为空（无定时任务），无实际影响。若将来某下游（如 user-service session reap）启用定时任务，需对该裸 handler 改用 `mgr.Add`（user-service 届时同理）。先按 user-service 走。

## 6. 删 adapter：SessionResolver 归 service 根

「session_id → user_id 怎么解析」是 testkit 的装配决策（怎么用 user-service），不是 user-service 的传输问题。`internal/thirdcall/user` 保持**纯净传输边界**（interface + module/grpc + config），不认识 `pkg/auth`。resolver 作为 `Service` 的方法放在 `internal/service/service.go`（与其它 accessor 并列），由装配根持有 UserService、调 `GetSession` 包成 `auth.SessionResolver`。

```go
// internal/service/service.go
func (s *Service) SessionResolver() auth.SessionResolver {
    return func(ctx context.Context, sessionID string) (int64, error) {
        resp, err := s.user.GetSession(ctx, &userv1.GetSessionRequest{SessionId: sessionID})
        if err != nil { return 0, fmt.Errorf("user get-session %q: %w", sessionID, err) }
        return resp.GetUserId(), nil
    }
}
```

`pkg/server.go` 改 `resolver := svc.SessionResolver()`。**`pkg/auth` 与 `pkg/server` 均不吃 gen**；`userv1` 只出现在 `internal/thirdcall/*`（定义 interface）与 `internal/service`（装配根的 resolver glue）这两处内部层。`internal/service → pkg/auth` 仅返回类型耦合，无环。

## 7. 删除清单

- `internal/adapter/`（整包，含 `user.go`/`user_test.go`）。
- `pkg/thirdcall/`（整包，含 `gid.go`/`message.go`/`storage.go`/`user.go`/`gid_test.go`）。
- `pkg/option/`（整包）。
- `pkg/module.go`（`NewModule` + `Handler` 别名 + 编译期断言）。

## 8. pkg/server.go 瘦身

- 删 `ServerOption` / `serverOptions` / `WithServiceOptions`。
- `NewServer(cfg *config.Config) (*Server, error)`：直接 `service.New(cfg)`（无 opts）。
- resolver 改 `svc.SessionResolver()`；删 `internal/adapter` import（不再需要 `internal/thirdcall/user`）。
- 拦截器链、gateway 注册、jwt manager 构造不变。

## 9. 子域改造（删本地接口，注入 thirdcall 接口）

| 子域 | 现状 | 改后字段/入参类型 |
|---|---|---|
| `auth` | 本地 `UserClient` | `thirdcalluser.UserService` |
| `gid` | 本地 `Client` | `thirdcallgid.GIDService` |
| `dashboard` | 本地 3 个 Client | `thirdcalluser.UserService` / `thirdcallstorage.StorageService` / `thirdcallmessage.MessageService` |
| `user` | `userv1.UserServiceServer` | `thirdcalluser.UserService` |
| `storage` | `storagev1.StorageServiceServer` | `thirdcallstorage.StorageService` |
| `message` | `messagev1.MessageServiceServer` | `thirdcallmessage.MessageService` |

子域仍 import 各自下游 gen 做 proto↔proto 转换（不变）；仅「持有/入参类型」改为 thirdcall 接口。import 别名用 `thirdcall<svc>` 以避开与子域包名（`user`/`storage`/`message`/`gid`）冲突。

## 10. config：不改

`RemoteServiceConfig[*xxxconfig.Config]`（Mode/Target/Config）与 user-service 同形——**结构零改动**；`Mode` 现在真正驱动 grpc/module 分支。`config.example.yaml` 可选补 grpc target 注释（非必须）。

## 11. 测试影响

- 删 `internal/adapter/*_test.go`、`pkg/thirdcall/*_test.go`、`pkg/option` 相关测试（如有）。
- 子域测试桩当前 embed `Unimplemented*Server` + override 方法——其方法签名是 server 风格，**正好满足手写 interface**；基本只需把桩的 `WithUserClient(...)` 形参/字段类型注解改为 thirdcall 接口。
- `internal/thirdcall/user/config_test.go` 保留。
- 新增（可选）：每个 thirdcall 包的 module/grpc 后端编译期断言（已在 §3.2 内置 `var _`）。

## 12. 不在本次范围 / 后续

- 下游启用定时任务时，回流式生命周期（`mgr.Add` 裸 handler）的 revisit（§5）。
- `config.RemoteServiceConfig` 的 `Mode`/`Target` 在纯 module 部署下的清理（保持现状，零改动）。
- 各下游 gen 方法演进的 interface 同步（手写接口的固有维护成本，靠编译期错误捕获）。

## 13. 文件级变更清单

**新增**
- `internal/service/init.go`
- `internal/thirdcall/{gid,message,storage,user}/<svc>.go`（手写 interface）

**重写**
- `internal/thirdcall/{gid,message,storage,user}/module.go`（改为 `NewModule(h, owns)` 包络）
- `internal/thirdcall/{gid,message,storage,user}/grpc.go`（改为真实拨号后端）
- `internal/service/service.go`（仅留结构体 + Start/Stop/Ping + facade + `SessionResolver()`）
- `pkg/server.go`（瘦身；resolver 走 `svc.SessionResolver()`）
- 各子域包（`auth/user/storage/message/gid/dashboard`）：字段/入参类型改 thirdcall 接口，删本地接口

**删除**
- `internal/adapter/`、`pkg/thirdcall/`、`pkg/option/`、`pkg/module.go`

**保留不动**
- `internal/thirdcall/user/config.go`、`pkg/config/`、`pkg/handler/`、`pkg/auth/`、`pkg/client.go`、`internal/jwt/`、`internal/jobs/`、`cmd/`
