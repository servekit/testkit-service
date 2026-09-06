import { MessageOutlined, SendOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import { PageContainer } from "@ant-design/pro-components";
import { useRegionOptions } from "@/hooks/useRegionOptions";
import { useState } from "react";
import {
  SMS_SCENE_OPTIONS,
  SMS_VENDOR_OPTIONS,
} from "@/components/messagetags";
import { sendSms } from "@/services/testkit/testkitService";

const { Text } = Typography;

/**
 * Web-SMS-console style compose page, matching the email compose layout:
 * recipient row (region + phone), message area with live segment counting,
 * and routing fields folded into an advanced panel.
 *
 * Path selection mirrors message-service and the old form: CN (mainland)
 * sends through vendor pre-registered templates (template_id + params JSON +
 * sign_name, regulator-mandated); other regions send free-form content.
 * vendor/account form a pair (CEL-enforced on the request; mirrored here by
 * making account required once a vendor is chosen). `sender_id` is NOT in the
 * form — the BFF injects it from cfg.Message.SenderID.
 */


// One character outside the GSM 7-bit set makes the whole message UCS-2
// encoded: 70 chars per segment (67 when multi-segment) instead of 160/153.
const GSM_CHAR_RE =
  /^[\r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}[\]~|€A-Za-z0-9 -]*$/;

function isGsmOnly(text: string): boolean {
  return GSM_CHAR_RE.test(text);
}

/** Standard SMS billing split: 70/67 for Unicode, 160/153 for GSM-7. */
function smsSegments(text: string): { count: number; perSegment: number } {
  const len = [...text].length;
  if (len === 0) {
    return { count: 0, perSegment: 0 };
  }
  const gsm = isGsmOnly(text);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return {
    count: len <= single ? 1 : Math.ceil(len / multi),
    perSegment: len <= single ? single : multi,
  };
}

interface SmsFormValues {
  regionCode?: string;
  phone?: string;
  content?: string;
  templateId?: string;
  templateParams?: string;
  signName?: string;
  scene?: string;
  vendor?: string;
  account?: string;
  idempotencyKey?: string;
}

const templateParamsValidator = (_: unknown, value?: string) => {
  if (!value) {
    return Promise.resolve();
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return Promise.resolve();
    }
  } catch {
    // fall through to reject
  }
  return Promise.reject(new Error("模板参数须为合法 JSON 对象"));
};

/** One label-left / input-right row, same rhythm as the email compose page. */
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
      <div
        style={{
          width: 72,
          flexShrink: 0,
          textAlign: "right",
          paddingRight: 12,
          color: "#51565d",
        }}
      >
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
  const regionOptions = useRegionOptions();
  const regionCode = Form.useWatch("regionCode", form);
  const content = Form.useWatch("content", form);
  const vendor = Form.useWatch("vendor", form);
  const isCN = regionCode === "CN";

  const handleSend = async () => {
    let vals: SmsFormValues;
    try {
      vals = await form.validateFields();
    } catch {
      // Validation errors render inline.
      return;
    }
    let templateParams: Record<string, string> | undefined;
    if (isCN && vals.templateParams) {
      try {
        templateParams = JSON.parse(vals.templateParams) as Record<
          string,
          string
        >;
      } catch {
        message.error("模板参数不是合法 JSON");
        return;
      }
    }
    const selectedVendor =
      vendor && vendor !== "SMS_VENDOR_UNSPECIFIED" ? vendor : undefined;
    const payload: API.v1SendSMSRequest = {
      regionCode: vals.regionCode,
      phone: vals.phone,
      content: isCN ? undefined : vals.content,
      templateId: isCN ? vals.templateId : undefined,
      templateParams,
      scene: vals.scene as API.v1SendSMSRequest["scene"],
      signName: vals.signName || undefined,
      vendor: selectedVendor as API.v1SendSMSRequest["vendor"],
      account: selectedVendor ? (vals.account ?? "") : "",
      idempotencyKey: vals.idempotencyKey || undefined,
    };
    setSending(true);
    try {
      const resp = await sendSms(payload);
      message.success(
        `发送成功 id=${resp.id ?? "-"} 状态=${resp.status ?? "-"}`,
      );
    } catch {
      // 401 is handled by the request interceptor; other errors surface via
      // the default error handler. Keep the compose content for retry.
    } finally {
      setSending(false);
    }
  };

  const segments = smsSegments(content ?? "");

  return (
    <PageContainer>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          regionCode: "CN",
          scene: "SMS_SCENE_LOGIN_CODE",
        }}
      >
        <Card bordered={false} styles={{ body: { padding: 0 } }}>
          <div style={{ padding: "8px 16px 0" }}>
            {fieldRow(
              "收信人",
              <Space style={{ width: "100%" }} size={8}>
                <Form.Item
                  name="regionCode"
                  noStyle
                  rules={[
                    { required: true, message: "请选择或输入区码" },
                    { pattern: /^[A-Z]{2}$/, message: "两位大写字母（ISO）" },
                  ]}
                >
                  <Select
                    options={regionOptions}
                    style={{ width: 150 }}
                    placeholder="区号"
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Form.Item
                  name="phone"
                  noStyle
                  rules={[
                    { required: true, message: "请输入手机号" },
                    { pattern: /^[^+]/, message: "本地号码，请去掉 + 前缀" },
                  ]}
                >
                  <Input
                    placeholder="手机号（本地号，无 +）"
                    style={{ flex: 1 }}
                  />
                </Form.Item>
              </Space>,
            )}
          </div>

          {isCN ? (
            <div style={{ padding: "12px 16px 4px" }}>
              <Text type="secondary" strong>
                短信内容（国内通道）
              </Text>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  国内短信须使用厂商预置模板：填写模板 ID 与参数
                  JSON，正文由模板渲染（签名与模板为监管要求）。
                </Text>
              </div>
              <div style={{ marginTop: 8 }}>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Form.Item
                    name="templateId"
                    noStyle
                    rules={[{ required: true, message: "CN 短信须填模板 ID" }]}
                  >
                    <Input placeholder="模板 ID（如 SMS_xxx）" />
                  </Form.Item>
                </Form.Item>
                <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                  <Form.Item
                    name="templateParams"
                    noStyle
                    rules={[{ validator: templateParamsValidator }]}
                  >
                    <Input.TextArea
                      autoSize={{ minRows: 2, maxRows: 6 }}
                      placeholder='模板参数 JSON，如 {"code":"123456"}'
                    />
                  </Form.Item>
                </Form.Item>
                <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                  <Form.Item
                    name="signName"
                    noStyle
                    rules={[{ required: true, message: "CN 短信须填签名" }]}
                  >
                    <Input placeholder="签名（CN 必填，监管要求）" />
                  </Form.Item>
                </Form.Item>
              </div>
            </div>
          ) : (
            <div style={{ padding: "12px 16px 4px" }}>
              <Text type="secondary" strong>
                短信内容
              </Text>
              <Form.Item style={{ marginTop: 8, marginBottom: 0 }}>
                <Form.Item
                  name="content"
                  noStyle
                  rules={[{ required: true, message: "请输入短信内容" }]}
                >
                  <Input.TextArea
                    autoSize={{ minRows: 6, maxRows: 12 }}
                    placeholder="请输入短信内容"
                    showCount={false}
                    style={{ fontSize: 14, lineHeight: 1.8 }}
                  />
                </Form.Item>
              </Form.Item>
              <div
                style={{
                  textAlign: "right",
                  padding: "6px 0",
                  color: "#8c8c8c",
                  fontSize: 12,
                }}
              >
                {[...(content ?? "")].length} 字 · {segments.count} 条短信
                {segments.count > 1 &&
                  `（长短信每条 ${segments.perSegment} 字计费）`}
              </div>
            </div>
          )}

          <div style={{ padding: "0 16px" }}>
            <Collapse
              ghost
              items={[
                {
                  key: "advanced",
                  label: "高级选项（业务场景 / 供应商 / 幂等键 / 签名）",
                  children: (
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          name="scene"
                          label="业务场景"
                          rules={[{ required: true, message: "请选择场景" }]}
                        >
                          <Select
                            options={SMS_SCENE_OPTIONS}
                            placeholder="选择场景"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="vendor" label="供应商（可选）">
                          <Select
                            options={SMS_VENDOR_OPTIONS}
                            placeholder="留空按区号路由"
                            allowClear
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name="account"
                          label="账号（与供应商成对）"
                          rules={
                            vendor && vendor !== "SMS_VENDOR_UNSPECIFIED"
                              ? [
                                  {
                                    required: true,
                                    message: "选了供应商须填账号",
                                  },
                                ]
                              : []
                          }
                        >
                          <Input
                            placeholder={
                              vendor && vendor !== "SMS_VENDOR_UNSPECIFIED"
                                ? "必填"
                                : "留空自动路由"
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="idempotencyKey" label="幂等键（可选）">
                          <Input placeholder="重试同一逻辑发送时填同一值" />
                        </Form.Item>
                      </Col>
                      {!isCN && (
                        <Col span={8}>
                          <Form.Item name="signName" label="签名（海外可选）">
                            <Input placeholder="留空使用账号默认签名" />
                          </Form.Item>
                        </Col>
                      )}
                    </Row>
                  ),
                },
              ]}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "8px 0 16px",
                borderTop: "1px solid #f0f0f0",
              }}
            >
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                loading={sending}
                onClick={handleSend}
              >
                发送
              </Button>
            </div>
          </div>
        </Card>
      </Form>
    </PageContainer>
  );
}
