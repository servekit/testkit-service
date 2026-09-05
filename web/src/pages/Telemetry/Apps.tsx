import {
  ModalForm,
  ProFormSwitch,
  ProFormText,
  ProFormSelect,
} from "@ant-design/pro-components";
import { App, Alert, Button, Card, Input, Modal, Popconfirm, Space } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  createApp,
  createSigningKey,
  getApp,
  replaceEventRules,
  revokeSigningKey,
  revokeToken,
  rotateToken,
  setVersionBlocked,
} from "@/services/testkit/testkitService";

type AppDetail = API.v1GetAppResponse;

/**
 * Telemetry app registry console. telemetry-service has no list RPC (registry
 * is slug-keyed), so the page is lookup-driven: enter a slug to load the full
 * app snapshot (tokens / signing keys / event rules / version gates), with
 * the mutating admin operations inline.
 */
export default function TelemetryAppsPage() {
  const { message } = App.useApp();
  const [slug, setSlug] = useState("");
  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (s: string) => {
      setError("");
      setDetail(null);
      if (!s) return;
      try {
        setDetail(await getApp({ slug: s }));
      } catch (err) {
        const e = err as { data?: { message?: string } };
        setError(e?.data?.message ?? "加载失败");
      }
    },
    [],
  );

  useEffect(() => {
    if (slug) void load(slug);
  }, [slug, load]);

  const act = async (label: string, fn: () => Promise<object | undefined>) => {
    try {
      const resp = await fn();
      message.success(`${label} 成功`);
      if (resp) {
        // show secret-bearing responses (rotated token, new signing key)
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
      void load(slug);
    } catch (err) {
      const e = err as { data?: { message?: string } };
      message.error(e?.data?.message ?? `${label} 失败`);
    }
  };

  return (
    <Card title="应用查询">
      <Space.Compact style={{ width: 480, marginBottom: 16 }}>
        <Input
          placeholder="slug（如 smoke-app）"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onPressEnter={() => void load(slug)}
        />
        <Button type="primary" onClick={() => void load(slug)}>
          查询
        </Button>
      </Space.Compact>

      <ModalForm
        title="创建应用"
        trigger={<Button style={{ marginInlineStart: 16 }}>创建应用</Button>}
        onFinish={async (vals) => {
          try {
            const resp = await createApp({
              slug: vals.slug,
              name: vals.name,
              email: vals.email,
              strictVersions: vals.strictVersions ?? false,
              authMode: vals.authMode,
            });
            message.success("已创建（token 仅此一次展示，见弹窗）");
            Modal.info({
              title: "应用已创建",
              width: 640,
              content: (
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {JSON.stringify(resp, null, 2)}
                </pre>
              ),
            });
            setSlug(vals.slug);
            return true;
          } catch (err) {
            const e = err as { data?: { message?: string } };
            message.error(e?.data?.message ?? "创建失败");
            return false;
          }
        }}
      >
        <ProFormText name="slug" label="Slug" rules={[{ required: true }]} />
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
      </ModalForm>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      {detail && (
        <>
          <Card type="inner" title="应用信息" style={{ marginBottom: 16 }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(detail.app, null, 2)}
            </pre>
          </Card>
          <Card
            type="inner"
            title={`Ingest Tokens（${detail.tokens?.length ?? 0}）`}
            extra={
              <Space>
                <Button
                  size="small"
                  onClick={() =>
                    act("轮换 Token", () => rotateToken({ slug }))
                  }
                >
                  轮换 Token
                </Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {(detail.tokens ?? []).map((t, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <code>{t.prefix}</code> — {t.status === "TOKEN_STATUS_ACTIVE" ? "生效中" : "已吊销"}
                {t.status === "TOKEN_STATUS_ACTIVE" && (
                  <Popconfirm
                    title="吊销该 Token？"
                    onConfirm={() =>
                      act("吊销 Token", () =>
                        revokeToken({ slug, prefix: t.prefix ?? "" }),
                      )
                    }
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
                onClick={() => act("创建签名密钥", () => createSigningKey({ slug }))}
              >
                新建
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            {(detail.signingKeys ?? []).map((k, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <code>{k.keyId}</code> — {k.publicKeyB64?.slice(0, 24)}…
                {k.status === "SIGNING_KEY_STATUS_ACTIVE" && (
                  <Popconfirm
                    title="吊销该签名密钥？"
                    onConfirm={() =>
                      act("吊销签名密钥", () =>
                        revokeSigningKey({ slug, keyId: k.keyId ?? "" }),
                      )
                    }
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
                        replaceEventRules({
                          slug,
                          rules: JSON.parse(rules),
                        }),
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
                  act("封锁版本", () =>
                    setVersionBlocked({ slug, version, blocked: true }),
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
    </Card>
  );
}
