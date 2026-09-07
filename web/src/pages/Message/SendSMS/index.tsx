import { SendOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Form, Input, Row, Select, Space, Typography } from "antd";
import { PageContainer } from "@ant-design/pro-components";
import { useRegionOptions } from "@/hooks/useRegionOptions";
import { SMS_SCENE_OPTIONS } from "@/components/messagetags";
import { sendSms } from "@/services/testkit/testkitService";
import { useState } from "react";

const { Text } = Typography;

/**
 * Policy-driven SMS compose: pick a scene + supply template params — the
 * message-service policy owns template/signature/vendor routing. The BFF
 * injects its app credentials; idempotency_key is optional.
 */

interface SmsFormValues {
  dialCode?: string;
  phone?: string;
  scene?: string;
  templateParams?: string;
  idempotencyKey?: string;
}

const paramsValidator = (_: unknown, value?: string) => {
  if (!value) return Promise.resolve();
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return Promise.resolve();
    }
  } catch {
    // fall through
  }
  return Promise.reject(new Error("模板参数须为合法 JSON 对象"));
};

function fieldRow(label: string, node: React.ReactNode) {
  return (
    <div
      style={{
        borderBottom: "1px solid #f0f0f0",
        display: "flex",
        alignItems: "center",
        minHeight: 44,
      }}
    >
      <div style={{ width: 84, flexShrink: 0, textAlign: "right", paddingRight: 12, color: "#51565d" }}>
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{node}</div>
    </div>
  );
}

export default function SendSMSPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<SmsFormValues>();
  const [sending, setSending] = useState(false);
  const [lastResp, setLastResp] = useState<string>("");
  const regionOptions = useRegionOptions();

  const onFinish = async (vals: SmsFormValues) => {
    let params: Record<string, string> = {};
    if (vals.templateParams) {
      try {
        params = JSON.parse(vals.templateParams);
      } catch {
        message.error("模板参数不是合法 JSON");
        return;
      }
    }
    setSending(true);
    try {
      const resp = await sendSms({
        dialCode: vals.dialCode,
        phone: vals.phone,
        scene: vals.scene,
        templateParams: params,
        ...(vals.idempotencyKey ? { idempotencyKey: vals.idempotencyKey } : {}),
      });
      message.success(`已提交（记录 #${resp.id}）`);
      setLastResp(JSON.stringify(resp, null, 2));
    } catch (err) {
      const e = err as { data?: { message?: string } };
      message.error(e?.data?.message ?? "发送失败");
    } finally {
      setSending(false);
    }
  };

  return (
    <PageContainer>
      <Row gutter={16}>
        <Col span={14}>
          <Card title="发送短信（按场景路由）">
            <Form form={form} layout="vertical" onFinish={onFinish}>
              {fieldRow(
                "收件人",
                <Space.Compact style={{ width: "100%" }}>
                  <Form.Item name="dialCode" noStyle initialValue="+86">
                    <Select
                      showSearch
                      style={{ width: 120 }}
                      options={regionOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item
                    name="phone"
                    noStyle
                    rules={[{ required: true, message: "请输入手机号" }]}
                  >
                    <Input placeholder="13800138000（不带 +）" />
                  </Form.Item>
                </Space.Compact>,
              )}
              {fieldRow(
                "场景",
                <Form.Item name="scene" noStyle rules={[{ required: true, message: "请选择场景" }]}>
                  <Select options={SMS_SCENE_OPTIONS} placeholder="选择发送策略绑定的场景" />
                </Form.Item>,
              )}
              {fieldRow(
                "模板参数",
                <Form.Item name="templateParams" noStyle rules={[{ validator: paramsValidator }]}>
                  <Input.TextArea
                    rows={3}
                    placeholder='{"code": "123456"} —— 参数名以模板声明为准'
                  />
                </Form.Item>,
              )}
              {fieldRow(
                "幂等键",
                <Form.Item name="idempotencyKey" noStyle>
                  <Input placeholder="可选；同键重放返回上次结果" maxLength={64} />
                </Form.Item>,
              )}
              <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={sending} icon={<SendOutlined />}>
                  发送
                </Button>
                <Text type="secondary" style={{ marginLeft: 12 }}>
                  模板/签名/厂商由该场景的策略决定（消息服务 → 策略管理）
                </Text>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={10}>
          <Card title="响应">
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", minHeight: 120 }}>
              {lastResp || "—"}
            </pre>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}
