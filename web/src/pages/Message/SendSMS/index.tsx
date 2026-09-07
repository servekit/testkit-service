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
  content?: string;
  idempotencyKey?: string;
}

// One character outside the GSM 7-bit set makes the whole message UCS-2
// encoded: 70 chars per segment (67 multi-segment) instead of 160/153.
const GSM_CHAR_RE =
  /^[\r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}[\]~|€A-Za-z0-9 -]*$/;

function isGsmOnly(text: string): boolean {
  return GSM_CHAR_RE.test(text);
}

function smsSegments(text: string): { count: number; perSegment: number } {
  const len = [...text].length;
  if (len === 0) return { count: 0, perSegment: 0 };
  const gsm = isGsmOnly(text);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return { count: len <= single ? 1 : Math.ceil(len / multi), perSegment: single };
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
  const dialCode = Form.useWatch("dialCode", form) ?? "+86";
  const content = Form.useWatch("content", form) ?? "";
  const isIntl = dialCode !== "+86";
  const seg = smsSegments(content);

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
        ...(isIntl && (vals.content ?? "").trim() ? { content: vals.content } : {}),
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
              {isIntl &&
                fieldRow(
                  "内容",
                  <Form.Item name="content" noStyle>
                    <Input.TextArea
                      rows={4}
                      placeholder="国际短信正文（自由撰写，支持 {{param}} 占位符，留空走模板渲染）"
                      showCount
                      maxLength={1000}
                    />
                  </Form.Item>,
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {seg.count > 0 ? `${seg.count} 段 / 每段 ${seg.perSegment} 字` : "GSM/UCS-2 自动分段"}
                  </Text>,
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
