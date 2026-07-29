# testkit-service 设计文档 v2（自包含 proto + swagger 前端联动）

- **日期**：2026-07-29
- **状态**：待评审
- **作者**：Claude（与 moss 协作）
- **阶段**：design / v2
- **取代**：[[2026-07-28-testkit-service-design]]（v1）。地基部分沿用 v1，本文聚焦 v1→v2 的三处变化及其完整落地。

---

## 1. 背景

v1 设计了一个把四个下游（gid / message / storage / user）聚合到单一前后端应用的 BFF（`testkit-service`）。v1 定稿后，下游服务发生重大变化：

- **四个下游都新增了 `api/swagger/`**（buf `openapiv2` → Swagger 2.0，生成产物）；
- **user-service 大幅扩容**（59 RPC / 90 message，新增 `ResetPassword`、`Permission`/`PermissionGroup` 全套 CRUD、`GetRole`、`ListGroupRoles`、`ListUserRoles` 等），storage / message 也有调整；
- 前端期望**直接从 swagger 生成前后端交互代码**（Ant Design Pro 支持），而不是手写请求层。

v1 §10 的核心决策「proto `import` 下游 proto、直接复用下游 message」与上述方向冲突：它把 testkit 绑死在下游 proto 上，且复用的下游 message 不适合直接做前端契约。本 v2 做三处调整：

1. **testkit proto 自包含**——不引用任何下游 proto，所有 message 自定义（按前端用途裁剪）；
2. **testkit 自己产出 `api/swagger/`**——按 `golang-service-development` skill（openapiv2），与四个下游一致；
3. **前端从 testkit 的 swagger 生成请求代码**——`@umijs/openapi` 管线，前端只消费 testkit 自己的 swagger。

**成功标准**（沿用 v1，补充一条）：
- docker-compose 一键拉起全栈；
- Web UI 端到端走通登录 → 用户/权限 → 文件 → 消息 → gid → 仪表盘；
- 鉴权闭环安全，改密/封号/登出即时失效；
- **前端请求层与类型 100% 由 `npm run openapi` 从 testkit.swagger.json 生成，无手写请求函数**；
- 后续新服务（如支付）只需加一个 thirdcall + 一组自包含 proto message + 一组前端页面，不动地基。

---

## 2. v1 → v2 的三处变化（总览）

| # | v1 | v2 | 动因 |
|---|---|---|---|
| A | proto `import` 下游 proto，复用下游 message（1:1 转发） | **自包含 proto**：不 import 下游 proto，每个前端能力一个 testkit 自有 message（裁剪），service 域包做映射 | 解耦下游 proto 变化；前端契约干净、安全字段下沉到 message 形状 |
| B | 无 swagger（仅 grpc-gateway HTTP） | **testkit 产出 `api/swagger/`**（openapiv2，与下游一致） | 前端 codegen 的输入；与组织内 5 服务统一 |
| C | 前端手写 request 层 | **前端 `npm run openapi` 从 swagger 生成 services + 类型** | 消除手写请求层，契约单一来源 |

下游功能覆盖度不变（仍「全功能覆盖」），但落地方式从「复用下游 message」改为「全量但裁剪的自有 message」。

---

## 3. Delta A：自包含 proto + 映射层

### 3.1 proto 文件

- 路径：`api/proto/testkit/v1/testkit.proto`
- `package testkit.v1`
- `option go_package = "github.com/servekit/testkit-service/gen/testkit/v1;testkitv1"`
- **import 只含标准件**：`google/api/annotations.proto`、`google/api/http.proto`、`buf/validate/validate.proto`、`google/protobuf/*.proto`。**禁止 import 任何下游 proto**（user/storage/message/gid 的 `.proto`）。
- 服务：`service TestKitService { ... }`，REST 前缀 `/api/v1/...`，每个 RPC 带 `google.api.http` 注解（同时驱动 grpc-gateway HTTP 路由和 swagger 生成）。

### 3.2 message 裁剪规则（「全量但裁剪」）

对每个「前端要用的下游 RPC」，在 testkit proto 里定义一个**裁剪过的自有 message**：

1. **去掉「调用方身份」字段**（下游用于 ownership 归属的 `owner` / `owner_type` / `owner_id`、以及「我的」类 RPC 里代表调用者本人的 `user_id`）——这些字段**不出现在 testkit 的 request message 里**，由 BFF 在映射时从 ctx 取调用者身份填入下游请求。这样「BFF 是唯一信任边界」从 handler 逻辑**下沉到 message 形状**强制：前端构造的请求里没有越权伪造调用者身份的字段。
   - **注意区分**「调用方身份」与「目标资源 ID」：admin / 查询类 RPC 里前端指定**操作目标**的字段（如 admin-GetUser 的目标 `user_id`、GetFile 的 `file_id`）是**合法的请求字段，保留**在 testkit message 里。判定标准：该字段描述的是「**谁在调用**」（从 ctx 注入，去掉）还是「**操作谁/什么**」（前端指定，保留）。
2. **去掉前端永远不读/不写的纯内部字段**（如下游的内部状态码、调试字段）。
3. **枚举在 testkit proto 里重新定义**（不引用下游 enum），DB 侧仍是 int32（沿用各下游既有约定）。
4. **必要时为前端聚合/改名**：若多个下游字段在前端总是组合使用，可在 testkit message 里合并；若下游命名对前端不友好，可改名（映射层负责翻译）。
5. **响应 message 同理裁剪**：只回前端需要的字段。

> 裁剪不是缩减功能覆盖——每个下游用户态能力都有对应 testkit RPC；裁剪的是 message 字段集，使其贴合前端用途。

### 3.3 映射层（testkit-msg ↔ 下游-msg 的唯一翻译点）

- 位置：`internal/service/<domain>/<domain>.go`（每个域一个文件，业务方法 + 映射函数同文件，符合各服务 CLAUDE.md「导出 API 在上、helper 在下」约定）。
- 该文件是**整个 testkit-service 里唯一同时 import `testkitv1` 与下游 gen（如 `userv1`）的地方**。
- 约定函数命名：`<method>ReqTo<DownSvc>` / `<method>RespFrom<DownSvc>`（例：`loginReqToUser` / `loginRespFromUser`）。
- 例（user/Login）：

```go
package user

import (
    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    userv1 "github.com/servekit/user-service/gen/user/v1"
)

func (s *Service) Login(ctx context.Context, req *testkitv1.LoginRequest) (*testkitv1.LoginResponse, error) {
    downReq := loginReqToUser(req)               // testkitv1.LoginRequest  → userv1.LoginRequest
    resp, err := s.userClient.Login(ctx, downReq) // thirdcall 接口仍用 userv1 类型
    if err != nil {
        return nil, err
    }
    return loginRespFromUser(resp), nil           // userv1.LoginResponse → testkitv1.LoginResponse
}
```

### 3.4 依赖边界（对 v1 §6 规则的微调）

v1 §6 规定「`internal/thirdcall/<name>/` 是唯一 import 下游 `gen/` 的地方」。引入映射层后调整为：

- **下游 `gen/` 只被两处 import**：
  1. `internal/thirdcall/<name>/`（client 接线：module / grpc 实现，调用下游 `pkg`）；
  2. `internal/service/<domain>/`（映射：引用下游 message 类型做翻译）。
- `pkg/handler/`、testkit proto、testkit `gen/` 对下游类型**完全无感**——它们只见 `testkitv1`。
- `pkg/thirdcall/<name>.go` 的接口**仍用下游 gen 类型**（自然，因为它包装的是返回 `userv1.UserServiceClient` 的下游 client）；这是 service 域包能做映射的原因。

```
pkg/handler (只见 testkitv1)
   │
internal/service/<domain> (testkitv1 ↔ 下游gen 翻译)  ◄── import 下游 gen ①（映射）
   │
pkg/thirdcall 接口 (下游 gen 类型)
   │
internal/thirdcall/<name> (module/grpc 接线)          ◄── import 下游 gen ②（client）
   │
下游 pkg.NewModule / NewClient
```

### 3.5 鉴权与 message 形状的配合

- 公开 RPC 白名单（不过 AuthInterceptor）：`Login` / `Register` / `SendVerificationCode` / `RefreshSession` / `Ping` / 各健康检查（沿用 v1 §5.3）。
- 鉴权 RPC：AuthInterceptor 从 JWT → session → `user_id` 注入 ctx；service 域包从 ctx 取 `user_id`，映射时填入下游请求的 `user_id` / `Owner{USER, user_id}`。
- **admin 端点本期不做 RBAC 鉴权应用**：testkit admin 端点仅做**登录态 + 身份注入**（`user_id` 从 ctx 注入），**不叠加** RBAC permission 校验。其 testkit request message 里**不含**目标 user_id 之外的越权字段，越权操作只能经 BFF 编排（message 形状兜底）。理由：user-service 的 RBAC 现阶段**只做 CRUD**（管理角色/权限/组数据），不做鉴权落地；**后续权限控制统一用 OPA 规则引擎**，本期不在此预埋。RBAC 的 CRUD 管理 UI（P2）照常做全。
- **双轨前端（按 UserType 分流页面，前端路由级、非 RBAC）**：testkit `User` message 透出 `user_type`（镜像 user-service：`USER_TYPE_NORMAL`=外部、`USER_TYPE_INTERNAL`=内部），登录响应即带。前端 `access.ts` 据此双轨：`canInternal`（INTERNAL）+ `canUser`（任意登录）。**INTERNAL → 内部后台管理页**（user admin / RBAC 管理 / storage admin / message / gid debug / dashboard，`access: 'canInternal'`）；**NORMAL → 普通用户后端页**（profile / identity / sessions / my-files / my-quota，`access: 'canUser'`）；登录后按 user_type 跳首页（INTERNAL→/dashboard，NORMAL→/profile）。这是**前端路由/菜单区分（用 UserType），不是 RBAC 鉴权**——后端各 admin 端点仍只登录态 + 身份注入、不做 permission 校验（RBAC 只 CRUD，后续 OPA，见上一条）。后续按 UserType 决定走 RBAC（内部）还是业务侧权限（外部）的服务端逻辑按需再加。

---

## 4. Delta B：testkit 的 api/swagger

- `buf.gen.yaml` 与四个下游**逐字一致**地加 openapiv2 插件：

```yaml
  # OpenAPI / Swagger 2.0 docs, derived from the google.api.http annotations.
  - remote: buf.build/grpc-ecosystem/openapiv2
    out: api/swagger
    opt:
      - simple_operation_ids=true  # operationId = "<RpcName>"
      - logtostderr=true
```

- `make proto` 产出 `api/swagger/testkit/v1/testkit.swagger.json`（Swagger 2.0）。
- 它是 **③ 生成产物**：提交进仓、由 `make proto` 重生、**永不手改**（见 skill §4 文件分类）。
- `go_package_prefix` 指向 `github.com/servekit/testkit-service/gen`，managed mode 配置与下游一致。

---

## 5. Delta C：前端 swagger 代码生成管线

### 5.1 工具链

- Ant Design Pro v6（Umi Max 4）自带 `@umijs/plugin-openapi`，引擎为 `@umijs/openapi`（chenshuai2144/openapi2typescript）。
- 引擎**主要面向 OpenAPI 3.0**；Swagger 2.0（openapiv2 产物）虽可作输入但版本探测不稳。因此前端在 codegen 前用 `swagger2openapi` 把 testkit 的 Swagger 2.0 转成 OpenAPI 3.0，再喂给 `max openapi`。这是 v2 选定的方案（方案 1：Swagger 2.0 + 前端转换），与组织内 5 服务一致、遵守「按 skill 新建 api/swagger」。
- 前端**只消费 testkit 自己的 swagger**——下游 4 个 swagger 是内部参考，不进前端 codegen。

### 5.2 配置与脚本

- 依赖：`@umijs/plugin-openapi`（Pro v6 模板自带）、`swagger2openapi`（devDependency）。
- `web/config/config.ts` 的 `openAPI` 字段（Pro v6 模板默认位置；若模板用 `config/openapi.ts` 则用之，二者皆插件识别）：

```ts
openAPI: {
  schemaPath: join(__dirname, 'openapi.json'),   // 转换后的 OpenAPI 3.0（见下脚本）
  requestLibPath: "import { request } from '@umijs/max'",
  mock: false,
}
```

- `web/package.json`：

```json
{
  "scripts": {
    "openapi": "swagger2openapi ../api/swagger/testkit/v1/testkit.swagger.json -o config/openapi.json && max openapi"
  }
}
```

- `npm run openapi` 的产物：`src/services/testkit/` 下的 TS 请求函数 + `src/services/testkit/typings.d.ts`（`declare namespace API` 类型）。**生成物不手改**，改 proto 后重跑即可。

### 5.3 工作流

1. 后端改 `api/proto/testkit/v1/testkit.proto` → `make proto`（重生 testkit gen + `api/swagger/testkit/v1/testkit.swagger.json`）。
2. 前端 `npm run openapi`（2.0→3.0 转换 + 生成 services/类型）。
3. 前端页面 `import { ... } from '@/services/testkit'` 使用。
4. 转换步骤的健壮性兜底：若 `max openapi` 直接吃 Swagger 2.0 成功（简单 spec 有时可以），可在实现期去掉 `swagger2openapi`，但默认保留。

---

## 6. 沿用 v1 的地基（未变，详见 v1 对应章节）

| 主题 | v1 章节 | 要点 |
|---|---|---|
| 定位 / 整体架构 | v1 §2–3 | 单进程 BFF，in-process embed 四下游；grpcx server + 拦截器链 |
| 目录结构 | v1 §4 | 基本不变；新增：`internal/service/<domain>/` 承载映射层（已有） |
| 鉴权闭环 | v1 §5 | JWT(承载 session_id) + user-service 有状态校验；AuthInterceptor + 白名单 |
| thirdcall embed | v1 §6 | 双层（pkg/thirdcall 接口 + internal/thirdcall module/grpc）；默认 mode=module；共享 PG/Redis。**仅依赖边界按 §3.4 微调** |
| 配置聚合 | v1 §7 | Config 聚合 4 下游 RemoteServiceConfig，env prefix `TESTKIT` |
| 迁移编排 | v1 §8 | 单进程内统一迁移（user/storage/message 的 `pkg.Migrate`），gid 无 DB 跳过 |
| 前端托管 / 端口 | v1 §9.3–9.4 | nginx 独立托管；gRPC `:19095`、gateway `:18085`、nginx `:8080` |
| 技术栈 | v1 §9.1 | Ant Design Pro v6（React 19 + antd 6 + Umi Max 4 + ProComponents）；锁定主版本 |
| 命名 / 脚手架 | v1 §17 | `new-service.sh testkit --thirdcall --redis` 生成骨架，后按 skill 演进 |

> v1 §9.1 中「请求层手写、token 存内存、刷新走 refresh」的鉴权请求行为保留；仅请求函数与类型的**来源**从手写改为 swagger 生成（§5）。

---

## 7. 更正后的功能清单（按真实 RPC 数）

> 每行 = 一个 testkit 聚合 RPC（自有裁剪 message）。下游 RPC 数已按实际 proto 核实（v1 的 storage「~40」、message「15」为旧估，已更正）。

| 期 | 域 | 下游 RPC | testkit 暴露（裁剪后约） | REST 前缀 |
|---|---|---|---|---|
| P1 | auth | user: Login/Register/SendVerificationCode/Logout/RefreshSession | ~5（自含 JWT 签发） | `/api/v1/auth/*`、`/api/v1/captcha/*`、`/api/v1/health` |
| P2 | user 全套 | **59** | ~55 | `/api/v1/users/*`、`/api/v1/rbac/*`、`/api/v1/sessions/*`、`/api/v1/identities/*`、`/api/v1/social/*` |
| P3 | storage | **30** | ~28 | `/api/v1/files/*`、`/api/v1/storage/*` |
| P4 | message | **14** | ~13 | `/api/v1/messages/*` |
| P5 | gid + 仪表盘 | 4 | 3 + 1 聚合 | `/api/v1/gid/*`、`/api/v1/dashboard` |

P5 仪表盘 `GetDashboard` 为聚合型（并发调 GetEmailStats + GetSMSStats + GetMyQuota + ListUsersPaged 合并），自定义 message；其余为 1:1 转发型（自有 message + 映射）。

---

## 8. 分期交付（在 v1 基础上的微调）

P1–P6 结构与目标不变（见 v1 §12）。**每期新增两项固定工作**：

1. **后端**：为该域在 `api/proto/testkit/v1/testkit.proto` 自写裁剪过的 message + RPC（带 http 注解）→ `make proto`；在 `internal/service/<domain>/` 写映射函数。
2. **前端**：`npm run openapi` 重生该域 services/类型；页面改用生成的 services。

| 期 | 内容 | 交付物 |
|---|---|---|
| **P1** 地基 + 认证闭环 | scaffold 骨架 + 扩 4 thirdcall embed + JWT AuthInterceptor + 配置聚合 + 统一迁移 + docker-compose（含 nginx）+ 前端骨架（ProLayout + 登录页）+ auth 子集 **+ Delta B（buf 加 openapiv2）+ Delta C（前端 openapi 管线打通）** | 可登录的空壳应用；`npm run openapi` 能从 testkit.swagger.json 生成 auth 域 services |
| **P2** 用户与权限 | user 全套（59 RPC → ~55 自有 message）UI | 用户运营后台 |
| **P3** 文件 | storage 全套（30 → ~28）UI | 文件管理台 |
| **P4** 消息 | message 全套（14 → ~13）UI | 消息管理台 |
| **P5** gid + 仪表盘 | gid 调试 + 全局仪表盘 | 完整聚合平台 |
| **P6** 扩展 | 支付等新服务（加 thirdcall + 自有 proto message + 前端页面） | 验证可扩展性 |

每期独立可验收：proto + 映射 + handler + service + 前端页面 + 端到端测试 + `npm run openapi` 产物。

---

## 9. 错误处理

- 下游 `xerr.Error` **透传**：映射层不吞错、不重映射，保留 httpCode；grpcx `ErrorInterceptor` 映射 gRPC status，grpc-gateway 转对应 HTTP 码。
- testkit 自身错误统一 `go-common/xcodes`（`pkg/xcodes/<domain>.go` 按域分文件）。
- 前端：Ant Design Pro 约定的统一错误处理（`request` 拦截器 + 全局 message），消费生成 services 的统一返回结构。
- JWT 失败 / session 失效 → `ErrUnauthorized`（401，前端跳登录）。

---

## 10. 测试策略

- **映射层单测（v2 重点）**：每域一张 testkit-msg ↔ 下游-msg 映射表，覆盖字段裁剪、枚举转换、ctx 注入字段填充。
- handler / service 集成测试：embed 真实 4 服务 + `dbx.SetupTestDB`（testcontainer PG）+ `redisx.NewTestClient`（miniredis），覆盖登录 → 带 token 调下游。
- AuthInterceptor 单测：JWT 签发/验签/过期/白名单。
- thirdcall facade 单测：module/grpc 两 mode。
- 前端：Ant Design Pro 默认 setup（关键页面快照/交互）；额外断言「services 来自生成、无手写请求函数」。
- 每期验收：`make proto && make generate && go build ./... && go test -race ./... && golangci-lint run` + 前端 `npm run openapi` + 关键页面跑通。

---

## 11. 安全（产品级，沿用 v1 §15 并强化）

- BFF 是唯一信任边界：所有下游 `user_id` / `Owner` 由 BFF 从 ctx 注入。**v2 强化：这些字段在 testkit request message 里根本不存在**（§3.2 规则 1），前端无法在协议层指定越权目标。
- JWT：HS256，secret 从 env（不入 git），合理 exp + 刷新。
- session_id 仅在 JWT claims；前端只持有 JWT。
- CORS：严格 `allowed_origins` 白名单（生产）。
- 限流：登录 / 验证码 / 发消息等敏感端点用 `go-common/ratelimit`（Redis 固定窗口）。
- 审计：关键操作记日志（P1 起步，后续可加 BFF 自有审计表）。
- 存储 admin / 业务配额端点：仅 BFF 编排可达，前端 admin 入口**仅登录态校验**（RBAC 鉴权本期不做，见 §3.5；后续 OPA）。

---

## 12. 非目标（P1 不做，沿用 v1 §16）

- BFF 自有持久化（审计/聚合表）——需要时按 skill 加 `internal/store/`。
- shadcn 双 UI 体系。
- OAuth 真实 provider 对接——开发期 mock/占位。
- 支付等服务——P6。
- 生产 k8s 部署——当前 docker-compose 优先。
- **RBAC 鉴权应用 / OPA 规则引擎**——user-service 的 RBAC 现阶段只做 CRUD（管理数据），不做鉴权落地；testkit admin 端点本期仅登录态 + 身份注入，不叠加 permission 校验。后续权限控制统一用 OPA 规则引擎（见 §3.5）。
- 为下游 4 个 swagger 做前端 codegen——下游 swagger 仅内部参考。

---

## 关联

**取代：**
- [[2026-07-28-testkit-service-design]]（v1，地基章节仍有效，见本文 §6）

**实现计划（待更新 / 待写）：**
- `docs/superpowers/plans/2026-07-28-testkit-service-p1-foundation.md`（P1 地基，需按 §8 增补 Delta B/C 与每期两项固定工作）
- 后续 P2–P5 计划待写

**相关服务：**
- [[user-service]]（59 RPC / 90 message）
- [[storage-service]]（30 RPC / 61 message）
- [[message-service]]（14 RPC / 30 message）
- [[gid-service]]（4 RPC / 7 message）

**遵循 skill：**
- `golang-service-development`（架构 / api-swagger / 脚手架）
- `proto-development`（proto 写法 / protovalidate / buf）
- `golang-development`（Go 风格 / lint）
