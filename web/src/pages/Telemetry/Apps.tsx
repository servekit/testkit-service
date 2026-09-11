/**
 * Telemetry 平台 · 租户配置（④T6 更名，原「应用管理」）。每个租户一行配置，
 * 支持停用（kill-switch，停用后上报立即 401）与轮换令牌。④ 窗口关闭后配置
 * 行不再携带 ak/sk（app_secret 列已删）：后端/模块面调用经 portal 入口注入可
 * 信 x-tenant-key。令牌 / 签名密钥 / 事件规则 / 版本门禁等深度配置保留在行内
 * 「配置」弹窗（按 tenant_key 定位行）。ingest token 仅创建/轮换时明文展示
 * 一次（落库即哈希——上报面暴露在公网）。
 */
import {
  ModalForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from "@ant-design/pro-components";
import {
  App,
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Space,
  Tag,
} from "antd";
import { useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  createSigningKey,
  createTenantConfig,
  getTenantConfig,
  listTenantConfigs,
  replaceEventRules,
  revokeSigningKey,
  revokeToken,
  rotateToken,
  setVersionBlocked,
  updateTenantConfig,
} from "@/services/testkit/testkitService";

type AppRow = API.telemetryV1TenantConfig;
type AppDetail = API.testkitV1GetTenantConfigResponse;

export default function TelemetryAppsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  // 「配置」弹窗：按 tenant_key 加载完整快照（tokens / 签名密钥 / 规则 / 版本门禁）
  const [detailTenantKey, setDetailSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppDetail | null>(null);

  const loadDetail = async (tenantKey: string) => {
    try {
      setDetail(await getTenantConfig({ tenantKey }));
    } catch (err) {
      const e = err as { data?: { message?: string } };
      message.error(e?.data?.message ?? "加载失败");
    }
  };

  // secret 类响应（轮换 token / 新建签名密钥）只展示一次
  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      const resp = (await fn()) as Record<string, unknown> | undefined;
      message.success(`${label} 成功`);
      if (resp && Object.keys(resp).length > 0) {
        Modal.info({
          title: label,
          width: 640,
          content: (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(resp, null, 2)}
            </pre>
          ),
        });
      }
      if (detailTenantKey) void loadDetail(detailTenantKey);
      reload();
    } catch (err) {
      const e = err as { data?: { message?: string } };
      message.error(e?.data?.message ?? `${label} 失败`);
    }
  };

  const columns: ProColumns<AppRow>[] = [
    { title: "名称", dataIndex: "name", width: 160, ellipsis: true },
    {
      title: "AppKey",
      dataIndex: "appKey",
      width: 160,
      render: (_, r) => <code>{r.appKey}</code>,
    },
    {
      title: "状态",
      dataIndex: "disabled",
      width: 80,
      render: (_, r) => (r.disabled ? <Tag color="red">停用</Tag> : <Tag color="green">启用</Tag>),
    },
    {
      title: "认证模式",
      dataIndex: "authMode",
      width: 100,
      render: (_, r) =>
        r.authMode === "AUTH_MODE_HMAC" ? <Tag color="purple">HMAC</Tag> : <Tag>无</Tag>,
    },
    {
      title: "严格版本",
      dataIndex: "strictVersions",
      width: 90,
      render: (_, r) => (r.strictVersions ? <Tag color="orange">开</Tag> : <Tag>关</Tag>),
    },
    {
      title: "日预算",
      dataIndex: "dailyEventBudget",
      width: 110,
      render: (_, r) => (Number(r.dailyEventBudget) > 0 ? Number(r.dailyEventBudget).toLocaleString() : "不限"),
    },
    {
      title: "操作",
      valueType: "option",
      width: 240,
      render: (_, r) => [
        <a
          key="config"
          onClick={() => {
            setDetailSlug(r.tenantKey ?? null);
            setDetail(null);
            void loadDetail(r.tenantKey ?? "");
          }}
        >
          配置
        </a>,
        <a
          key="rotate"
          onClick={() => {
            void act("轮换 Token", () => rotateToken({ tenantKey: r.tenantKey ?? "" }, {} as never));
          }}
        >
          轮换令牌
        </a>,
        <a
          key="toggle"
          onClick={async () => {
            try {
              await updateTenantConfig({ tenantKey: r.tenantKey ?? "" }, { disabled: !r.disabled });
              message.success(r.disabled ? "已启用" : "已停用（上报立即 401）");
              reload();
            } catch (err) {
              const e = err as { data?: { message?: string } };
              message.error(e?.data?.message ?? "操作失败");
            }
          }}
        >
          {r.disabled ? "启用" : "停用"}
        </a>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<AppRow>
        headerTitle="租户配置列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        scroll={{ x: 1100 }}
        request={async () => {
          const resp = await listTenantConfigs();
          return { data: (resp.configs ?? []) as AppRow[], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="创建租户配置"
            onFinish={async (vals) => {
              try {
                const resp = await createTenantConfig({
                  name: vals.name,
                  email: vals.email,
                });
                // 严格版本 / 鉴权模式不在创建协议里，创建后立即补一次更新
                // （行的 tenant_key 从创建响应里取；跨视图留空时为铸造字面量）。
                const mintedTenant = resp.config?.tenantKey;
                if (mintedTenant && (vals.strictVersions || vals.authMode !== "AUTH_MODE_NONE")) {
                  await updateTenantConfig(
                    { tenantKey: mintedTenant },
                    {
                      strictVersions: vals.strictVersions ?? false,
                      ...(vals.authMode !== "AUTH_MODE_NONE" ? { authMode: vals.authMode } : {}),
                    },
                  );
                }
                message.success("已创建（token 仅此一次展示，见弹窗）");
                Modal.info({
                  title: "租户配置已创建",
                  width: 640,
                  content: (
                    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {JSON.stringify(resp, null, 2)}
                    </pre>
                  ),
                });
                reload();
                return true;
              } catch (err) {
                const e = err as { data?: { message?: string } };
                message.error(e?.data?.message ?? "创建失败");
                return false;
              }
            }}
            trigger={<Button type="primary">创建租户配置</Button>}
          >
            <ProFormText name="name" label="名称" rules={[{ required: true }]} />
            <ProFormText name="email" label="联系邮箱" />
            <ProFormSwitch name="strictVersions" label="严格版本门禁" />
            <ProFormSelect
              name="authMode"
              label="上报鉴权模式"
              initialValue="AUTH_MODE_NONE"
              options={[
                { value: "AUTH_MODE_NONE", label: "无鉴权" },
                { value: "AUTH_MODE_HMAC", label: "HMAC" },
              ]}
            />
          </ModalForm>,
        ]}
      />
      <Space style={{ marginTop: 8, color: "#888" }}>
        后端/模块面调用 Ingest 经 portal 入口注入可信 x-tenant-key（④ 窗口关闭后 ak/sk
        凭据已废弃，app_secret 轮换接口已删除；ingest 令牌经「轮换 Token」维护）；终端客户端的上报走 ingest
        token（仅创建/轮换时明文展示一次，落库即哈希），两个维度互不影响。停用是运维
        kill-switch：停用应用的上报立即 401（凭据保留，重新启用即恢复）；事件规则与版本门禁在行内「配置」维护。
      </Space>

      <Modal
        open={detailTenantKey !== null}
        title={`租户配置 — ${detailTenantKey ?? ""}`}
        footer={null}
        width={860}
        onCancel={() => setDetailSlug(null)}
      >
        {!detail && "加载中…"}
        {detail && (
          <>
            <Card type="inner" title="配置信息" style={{ marginBottom: 16 }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {JSON.stringify(detail.config, null, 2)}
              </pre>
            </Card>
            <Card
              type="inner"
              title={`Ingest Tokens（${detail.tokens?.length ?? 0}）`}
              extra={
                <Button
                  size="small"
                  onClick={() => act("轮换 Token", () => rotateToken({ tenantKey: detailTenantKey ?? "" }, {} as never))}
                >
                  轮换 Token
                </Button>
              }
              style={{ marginBottom: 16 }}
            >
              {(detail.tokens ?? []).map((t, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <code>{t.prefix}</code> — {t.revoked ? "已吊销" : "生效中"}
                  {!t.revoked && (
                    <Popconfirm
                      title="吊销该 Token？"
                      onConfirm={() => {
                        void act("吊销 Token", () =>
                          revokeToken({ tenantKey: detailTenantKey ?? "", prefix: t.prefix ?? "" }),
                        );
                      }}
                    >
                      <Button size="small" type="link" danger>
                        吊销
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              ))}
              {!detail.tokens?.length && "（无）"}
            </Card>
            <Card
              type="inner"
              title={`签名密钥（${detail.signingKeys?.length ?? 0}）`}
              extra={
                <Button
                  size="small"
                  onClick={() => {
                    const keyId = window.prompt("签名密钥 ID（如 k202609，一个客户端版本段一把）", "k1");
                    if (!keyId) return;
                    act("创建签名密钥", () =>
                      createSigningKey({ tenantKey: detailTenantKey ?? "" }, { keyId }),
                    );
                  }}
                >
                  新建
                </Button>
              }
              style={{ marginBottom: 16 }}
            >
              {(detail.signingKeys ?? []).map((k, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <code>{k.keyId}</code> — {k.revoked ? "已吊销" : "生效中"}
                  {!k.revoked && (
                    <Popconfirm
                      title="吊销该签名密钥？"
                      onConfirm={() => {
                        void act("吊销签名密钥", () =>
                          revokeSigningKey({ tenantKey: detailTenantKey ?? "", keyId: k.keyId ?? "" }),
                        );
                      }}
                    >
                      <Button size="small" type="link" danger>
                        吊销
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              ))}
              {!detail.signingKeys?.length && "（无）"}
            </Card>
            <Card
              type="inner"
              title="事件规则 / 版本门禁"
              extra={
                <Button
                  size="small"
                  onClick={() => {
                    const rules = window.prompt(
                      "输入事件规则 JSON 数组（ReplaceEventRules）",
                      "[]",
                    );
                    if (rules != null) {
                      try {
                        act("替换事件规则", () =>
                          replaceEventRules(
                            { tenantKey: detailTenantKey ?? "" },
                            { rules: JSON.parse(rules) },
                          ),
                        );
                      } catch {
                        message.error("JSON 解析失败");
                      }
                    }
                  }}
                >
                  替换规则
                </Button>
              }
              style={{ marginBottom: 16 }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {JSON.stringify(detail.rules, null, 2)}
              </pre>
              <Space.Compact style={{ marginTop: 8 }}>
                <Input
                  placeholder="版本号（如 1.2.3）"
                  id="version-input"
                  style={{ width: 200 }}
                />
                <Button
                  onClick={() => {
                    const el = document.getElementById("version-input") as HTMLInputElement;
                    const version = el?.value ?? "";
                    if (!version) {
                      message.warning("请输入版本号");
                      return;
                    }
                    void act("封锁版本", () =>
                      setVersionBlocked({ tenantKey: detailTenantKey ?? "", version }, { blocked: true }),
                    );
                  }}
                >
                  封锁该版本
                </Button>
              </Space.Compact>
              <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(detail.versions, null, 2)}
              </pre>
            </Card>
          </>
        )}
      </Modal>
    </PageContainer>
  );
}
