# testkit-service

基于 [go-common](https://github.com/servekit/go-common) 的 gRPC + grpc-gateway 服务。

## 构建与运行

服务与数据库迁移合并为同一个二进制（`cmd/server`），通过子命令区分：

| 命令 | 作用 |
|---|---|
| `bin/testkit-service` 或 `bin/testkit-service serve` | 启动 gRPC + HTTP 服务（默认） |
| `bin/testkit-service migrate` | 执行 GORM AutoMigrate 后退出 |
| 其他 | 打印用法，exit 2 |

本地开发常用命令（完整 target 见 `Makefile`）：

```bash
make build       # 产出 bin/testkit-service
make run         # 本地启动（auto-cp config.example.yaml -> config.yaml）
make regenerate  # = generate + tidy（改 model 后跑；proto 变更去 ../api 仓库）
make migrate     # 执行数据库迁移
make test        # 测试（race + coverage）
make lint        # golangci-lint
make docker-up   # 起完整 docker 栈（含 postgres）
```

gRPC 监听 `:19095`，HTTP gateway 监听 `:18085`（nginx `/api/` 反代到这里）。
gateway 上除 testkit 自己的转码 RPC 外，还托管两个后端面：

- **telemetry 摄入端点**（`POST /v1/e/{token}/events`、`POST /v1/collect/events`）
  —— 挂载 telemetry-service 的 `pkg/ingesthttp` 模块（HMAC 覆盖原始字节、
  204/413/429 精确语义，客户端 SDK 上报地址即本端口）；
- **`GET /metrics`**（Prometheus）—— module 模式下内嵌 telemetry 的
  `collector_*` 计数器与本进程指标都在这里。

## 配置

`config.example.yaml` 是**纯结构**——每个值都是 `${VAR}` 占位符，由 configx `WithExpandEnv` 从进程环境展开。`.env.example` 是 **docker-compose 取向**的默认值源（host 名是 compose 服务名）。前者管结构，后者管值。

**本地跑（`make run`）：**

```bash
cp .env.example .env
# 把 docker host 名改成本地地址（config.yaml 由 make run 自动从 config.example.yaml 拷出）：
#   TESTKIT_SERVICE_DATABASE_HOST: postgres  ->  localhost
make run            # 需要本机 PostgreSQL
```

**docker compose 跑（`make docker-up`）：** 无需改 `.env`——compose 注入全部 env，host 名正好是服务名（`postgres`）。改配置值都改 `.env`，不要往 `config.example.yaml` 写字面量。

**构建在受限网络（proxy.golang.org 不通）？** 在 `.env` 加 `GOPROXY=https://goproxy.cn,direct` 再 `make docker-build` / `make docker-up`。

## 测试调用

```bash
# gRPC（按 proto 字段调整 payload）
grpcurl -plaintext -d '{"name":"hi"}' \
  localhost:9000 testkit.v1.TestkitService/CreateTestkit

# HTTP
curl -X POST http://localhost:8080/v1/testkits \
  -H "Content-Type: application/json" \
  -d '{"name":"hi"}'
```

> 架构规范（分层、枚举、thirdcall、lifecycle 等）见 `CLAUDE.md`。
