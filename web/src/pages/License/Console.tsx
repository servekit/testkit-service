import {
  PageContainer,
  ProFormText,
  ProFormDependency,
} from "@ant-design/pro-components";
import { Alert, Button, Card, Form, Tabs, Typography } from "antd";
import { useState } from "react";
import {
  activate,
  deactivate,
  health,
  showPubKey,
  trialStart,
} from "@/services/testkit/testkitService";

const { Paragraph } = Typography;

function randomFingerprint(): string {
  const hex = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
  return `v1.${hex}`;
}

function randomUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * License client-side test console: exercise the public activation surface
 * (Activate / Deactivate / TrialStart / Health / ShowPubKey) exactly like an
 * end-user client would, with the fingerprint/device-token formats the
 * backend validates (v1.<64hex> / UUID).
 */
export default function LicenseConsolePage() {
  const [result, setResult] = useState<string>("");
  const [form] = Form.useForm();

  const run = async (label: string, fn: () => Promise<object | undefined>) => {
    try {
      const resp = await fn();
      setResult(`✓ ${label}\n${JSON.stringify(resp ?? {}, null, 2)}`);
    } catch (err) {
      const e = err as { data?: { message?: string } };
      setResult(`✗ ${label}\n${e?.data?.message ?? String(err)}`);
    }
  };

  const fpInitial = randomFingerprint();

  return (
    <PageContainer>
      <Card>
        <Tabs
          items={[
            {
              key: "activate",
              label: "激活 / 停用",
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  initialValues={{
                    fingerprintId: fpInitial,
                    deviceToken: randomUuid(),
                  }}
                >
                  <ProFormText
                    name="licenseKey"
                    label="License Key"
                    placeholder="AV1D-XXXXX-XXXXX-XXXXX-XXXXX"
                    rules={[{ required: true, message: "请输入密钥" }]}
                  />
                  <ProFormText
                    name="fingerprintId"
                    label="设备指纹（v1.<64hex>）"
                    rules={[{ required: true, message: "请输入设备指纹" }]}
                    fieldProps={{
                      addonAfter: (
                        <Button
                          size="small"
                          type="text"
                          onClick={() =>
                            form.setFieldValue(
                              "fingerprintId",
                              randomFingerprint(),
                            )
                          }
                        >
                          随机
                        </Button>
                      ),
                    }}
                  />
                  <ProFormText
                    name="deviceToken"
                    label="设备令牌（UUID）"
                    rules={[{ required: true, message: "请输入设备令牌" }]}
                    fieldProps={{
                      addonAfter: (
                        <Button
                          size="small"
                          type="text"
                          onClick={() =>
                            form.setFieldValue("deviceToken", randomUuid())
                          }
                        >
                          随机
                        </Button>
                      ),
                    }}
                  />
                  <ProFormDependency name={["licenseKey", "fingerprintId", "deviceToken"]}>
                    {({ licenseKey, fingerprintId, deviceToken }) => (
                      <>
                        <Button
                          type="primary"
                          onClick={() =>
                            run("Activate", () =>
                              activate({
                                licenseKey,
                                fingerprintId,
                                deviceToken,
                              }),
                            )
                          }
                        >
                          激活
                        </Button>
                        <Button
                          style={{ marginInlineStart: 8 }}
                          onClick={() =>
                            run("Deactivate", () =>
                              deactivate({
                                licenseKey,
                                deviceToken,
                              }),
                            )
                          }
                        >
                          停用设备
                        </Button>
                      </>
                    )}
                  </ProFormDependency>
                </Form>
              ),
            },
            {
              key: "trial",
              label: "试用",
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  initialValues={{
                    fingerprintId: fpInitial,
                    deviceToken: randomUuid(),
                  }}
                >
                  <ProFormText
                    name="module"
                    label="模块（MODULE_* 枚举值，可选）"
                    placeholder="留空 = 默认模块"
                  />
                  <ProFormText
                    name="fingerprintId"
                    label="设备指纹（v1.<64hex>）"
                    rules={[{ required: true, message: "请输入设备指纹" }]}
                  />
                  <ProFormText
                    name="deviceToken"
                    label="设备令牌（UUID）"
                    rules={[{ required: true, message: "请输入设备令牌" }]}
                  />
                  <ProFormDependency name={["module", "fingerprintId", "deviceToken"]}>
                    {({ module, fingerprintId, deviceToken }) => (
                      <Button
                        type="primary"
                        onClick={() =>
                          run("TrialStart", () =>
                            trialStart({
                              module: module || "MODULE_UNSPECIFIED",
                              fingerprintId,
                              deviceToken,
                            }),
                          )
                        }
                      >
                        开始试用
                      </Button>
                    )}
                  </ProFormDependency>
                </Form>
              ),
            },
            {
              key: "pubkey",
              label: "公钥 / 健康",
              children: (
                <>
                  <Button
                    type="primary"
                    onClick={() => run("ShowPubKey", () => showPubKey({}))}
                  >
                    查看签名公钥
                  </Button>
                  <Button
                    style={{ marginInlineStart: 8 }}
                    onClick={() => run("Health", () => health({}))}
                  >
                    健康检查
                  </Button>
                  <Paragraph type="secondary" style={{ marginTop: 12 }}>
                    公钥用于客户端离线校验激活证书的 Ed25519 签名。
                  </Paragraph>
                </>
              ),
            },
          ]}
        />
        {result && (
          <Alert
            style={{ marginTop: 16 }}
            type={result.startsWith("✓") ? "success" : "error"}
            message={
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {result}
              </pre>
            }
          />
        )}
      </Card>
    </PageContainer>
  );
}
