import {
  PageContainer,
  ProForm,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from "@ant-design/pro-components";
import { App, Card } from "antd";
import { sendSms } from "@/services/testkit/testkitService";
import { SMS_SCENE_OPTIONS, SMS_VENDOR_OPTIONS } from "@/components/messagetags";

/**
 * Ops-only ad-hoc SMS send. Calls the GENERATED sendSms service — no
 * hand-written fetch. `sender_id` is NOT in the form (BFF injects it from
 * cfg.Message.SenderID — plan decision 1). Routing depends on region:
 *   - CN (mainland): template path — templateId + templateParams JSON, signName
 *     required.
 *   - overseas: raw content path — free-form content, signName optional.
 * vendor/account form a pair (CEL-enforced; mirrored by making account required
 * once a vendor is chosen).
 */
export default function SendSMSPage() {
  const { message } = App.useApp();

  return (
    <PageContainer>
      <Card title="发送短信" bordered={false}>
        <ProForm
          layout="vertical"
          submitter={{ searchConfig: { submitText: "发送" } }}
          initialValues={{ regionCode: "CN" }}
          onFinish={async (vals) => {
            const isCN = vals.regionCode === "CN";
            let templateParams: Record<string, string> | undefined;
            if (isCN && vals.templateParams) {
              try {
                templateParams = JSON.parse(vals.templateParams);
              } catch {
                message.error("模板参数不是合法 JSON");
                return false;
              }
            }
            const vendor =
              vals.vendor && vals.vendor !== "SMS_VENDOR_UNSPECIFIED"
                ? vals.vendor
                : undefined;
            const payload: API.v1SendSMSRequest = {
              regionCode: vals.regionCode,
              phone: vals.phone,
              content: isCN ? undefined : vals.content,
              templateId: isCN ? vals.templateId : undefined,
              templateParams,
              scene: vals.scene,
              signName: vals.signName || undefined,
              vendor,
              account: vendor ? vals.account : "",
              idempotencyKey: vals.idempotencyKey || undefined,
            };
            try {
              const resp = await sendSms(payload);
              message.success(
                `发送成功 id=${resp.id ?? "-"} 状态=${resp.status ?? "-"}`,
              );
              return true;
            } catch {
              return false;
            }
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <ProFormText
              name="regionCode"
              label="区域码（ISO alpha-2）"
              placeholder="CN / US / HK ..."
              rules={[
                { required: true, message: "请输入区域码" },
                { pattern: /^[A-Z]{2}$/, message: "两位大写字母" },
              ]}
            />
            <ProFormText
              name="phone"
              label="手机号（本地号，无 +）"
              placeholder="13800138000"
              rules={[{ required: true, message: "请输入手机号" }]}
            />
          </div>

          <ProFormSelect
            name="scene"
            label="业务场景"
            options={SMS_SCENE_OPTIONS}
            placeholder="选择场景"
            rules={[{ required: true, message: "请选择场景" }]}
          />

          <ProFormDependency name={["regionCode"]}>
            {({ regionCode }) => (
              <ProFormText
                name="signName"
                label="签名"
                placeholder={regionCode === "CN" ? "CN 必填" : "海外可选"}
                rules={
                  regionCode === "CN"
                    ? [{ required: true, message: "CN 短信须填签名" }]
                    : []
                }
              />
            )}
          </ProFormDependency>

          {/* CN = template path; overseas = raw content path. The backend XORs
              template_id vs content (validated downstream). */}
          <ProFormDependency name={["regionCode"]}>
            {({ regionCode }) =>
              regionCode === "CN" ? (
                <>
                  <ProFormText
                    name="templateId"
                    label="模板 ID"
                    placeholder="SMS_xxx"
                    rules={[{ required: true, message: "CN 短信须填模板 ID" }]}
                  />
                  <ProFormTextArea
                    name="templateParams"
                    label='模板参数 JSON（如 {"code":"123456"}）'
                    placeholder='{"code":"123456"}'
                    fieldProps={{ autoSize: { minRows: 2 } }}
                  />
                </>
              ) : (
                <ProFormTextArea
                  name="content"
                  label="正文（海外 raw 内容）"
                  placeholder="请输入正文"
                  fieldProps={{ autoSize: { minRows: 4 } }}
                  rules={[{ required: true, message: "请输入正文" }]}
                />
              )
            }
          </ProFormDependency>

          <div style={{ display: "flex", gap: 8 }}>
            <ProFormSelect
              name="vendor"
              label="供应商（可选）"
              options={SMS_VENDOR_OPTIONS}
              placeholder="留空按区号路由"
            />
            <ProFormDependency name={["vendor"]}>
              {({ vendor }) => (
                <ProFormText
                  name="account"
                  label="账号（与供应商成对）"
                  placeholder={
                    vendor && vendor !== "SMS_VENDOR_UNSPECIFIED"
                      ? "必填"
                      : "留空自动路由"
                  }
                  rules={
                    vendor && vendor !== "SMS_VENDOR_UNSPECIFIED"
                      ? [{ required: true, message: "选了供应商须填账号" }]
                      : []
                  }
                />
              )}
            </ProFormDependency>
          </div>

          <ProFormText
            name="idempotencyKey"
            label="幂等键（可选）"
            placeholder="重试同一逻辑发送时填同一值"
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
}
