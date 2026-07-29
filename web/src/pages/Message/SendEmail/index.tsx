import {
  PageContainer,
  ProForm,
  ProFormDependency,
  ProFormList,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from "@ant-design/pro-components";
import { App, Card } from "antd";
import { sendEmail } from "@/services/testkit/testkitService";
import {
  EMAIL_SCENE_OPTIONS,
  EMAIL_VENDOR_OPTIONS,
} from "@/components/messagetags";

/**
 * Ops-only ad-hoc email send. Calls the GENERATED sendEmail service — no
 * hand-written fetch. `sender_id` is intentionally NOT in the form: the BFF
 * injects it from cfg.Message.SenderID (plan decision 1). vendor/account form a
 * pair (both set or both empty — enforced by a CEL on the request and mirrored
 * here by making account required once a vendor is chosen).
 */
export default function SendEmailPage() {
  const { message } = App.useApp();

  return (
    <PageContainer>
      <Card title="发送邮件" bordered={false}>
        <ProForm
          layout="vertical"
          submitter={{ searchConfig: { submitText: "发送" } }}
          onFinish={async (vals) => {
            const vendor =
              vals.vendor && vals.vendor !== "EMAIL_VENDOR_UNSPECIFIED"
                ? vals.vendor
                : undefined;
            const to = (vals.to ?? [])
              .filter((r: { email?: string }) => !!r?.email)
              .map((r: { email?: string; displayName?: string }) => ({
                email: r.email,
                displayName: r.displayName || undefined,
              }));
            const payload: API.v1SendEmailRequest = {
              to,
              cc: (vals.cc ?? [])
                .filter((r: { email?: string }) => !!r?.email)
                .map((r: { email?: string }) => ({ email: r.email })),
              bcc: (vals.bcc ?? [])
                .filter((r: { email?: string }) => !!r?.email)
                .map((r: { email?: string }) => ({ email: r.email })),
              subject: vals.subject,
              body: vals.body,
              htmlBody: vals.htmlBody || undefined,
              scene: vals.scene,
              vendor,
              account: vendor ? vals.account : "",
              idempotencyKey: vals.idempotencyKey || undefined,
              attachments: (vals.attachments ?? [])
                .filter((a: { url?: string }) => !!a?.url)
                .map((a: { filename?: string; url?: string; sizeBytes?: string }) => ({
                  filename: a.filename,
                  url: a.url,
                  sizeBytes: a.sizeBytes ? Number(a.sizeBytes) : undefined,
                })),
            };
            try {
              const resp = await sendEmail(payload);
              message.success(
                `发送成功 id=${resp.id ?? "-"} 状态=${resp.status ?? "-"}`,
              );
              return true;
            } catch {
              // 401 is handled by the request interceptor; other errors surface
              // via the default error handler. Keep the form mounted for retry.
              return false;
            }
          }}
        >
          <ProFormList
            name="to"
            label="收件人（至少一个）"
            initialValue={[{ email: "" }]}
            min={1}
            creatorRecord={{ email: "" }}
            creatorButtonProps={{ creatorButtonText: "添加收件人" }}
            itemRender={({ listDom, action }) => (
              <div style={{ display: "flex", alignItems: "flex-end", width: "100%" }}>
                <div style={{ flex: 1, paddingRight: 8 }}>{listDom}</div>
                {action}
              </div>
            )}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <ProFormText
                name="email"
                placeholder="邮箱"
                rules={[
                  { required: true, message: "请输入邮箱" },
                  { type: "email", message: "邮箱格式不正确" },
                ]}
              />
              <ProFormText name="displayName" placeholder="显示名（可选）" />
            </div>
          </ProFormList>

          <ProFormList
            name="cc"
            label="抄送（可选）"
            creatorRecord={{ email: "" }}
            creatorButtonProps={{ creatorButtonText: "添加抄送" }}
          >
            <ProFormText
              name="email"
              placeholder="邮箱"
              rules={[{ type: "email", message: "邮箱格式不正确" }]}
            />
          </ProFormList>

          <ProFormList
            name="bcc"
            label="密送（可选）"
            creatorRecord={{ email: "" }}
            creatorButtonProps={{ creatorButtonText: "添加密送" }}
          >
            <ProFormText
              name="email"
              placeholder="邮箱"
              rules={[{ type: "email", message: "邮箱格式不正确" }]}
            />
          </ProFormList>

          <ProFormText
            name="subject"
            label="主题"
            placeholder="请输入主题"
            rules={[{ required: true, message: "请输入主题" }]}
          />
          <ProFormTextArea
            name="body"
            label="纯文本正文"
            placeholder="请输入正文"
            fieldProps={{ autoSize: { minRows: 4 } }}
          />
          <ProFormTextArea
            name="htmlBody"
            label="HTML 正文（可选）"
            placeholder="<b>HTML</b> 正文，留空则使用纯文本"
            fieldProps={{ autoSize: { minRows: 4 } }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <ProFormSelect
              name="scene"
              label="业务场景"
              options={EMAIL_SCENE_OPTIONS}
              placeholder="选择场景"
              rules={[{ required: true, message: "请选择场景" }]}
            />
            <ProFormSelect
              name="vendor"
              label="供应商（可选）"
              options={EMAIL_VENDOR_OPTIONS}
              placeholder="留空走默认"
            />
            <ProFormDependency name={["vendor"]}>
              {({ vendor }) => (
                <ProFormText
                  name="account"
                  label="账号（与供应商成对）"
                  placeholder={
                    vendor && vendor !== "EMAIL_VENDOR_UNSPECIFIED"
                      ? "必填"
                      : "留空走默认"
                  }
                  rules={
                    vendor && vendor !== "EMAIL_VENDOR_UNSPECIFIED"
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
            placeholder="重试同一逻辑发送时填同一值（UUID）"
          />

          <ProFormList
            name="attachments"
            label="附件（URL；大文件用 OSS 预签名）"
            creatorRecord={{ filename: "", url: "" }}
            creatorButtonProps={{ creatorButtonText: "添加附件" }}
            itemRender={({ listDom, action }) => (
              <div style={{ display: "flex", alignItems: "flex-end", width: "100%" }}>
                <div style={{ flex: 1, paddingRight: 8 }}>{listDom}</div>
                {action}
              </div>
            )}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <ProFormText
                name="filename"
                placeholder="文件名"
                rules={[{ required: true, message: "请输入文件名" }]}
              />
              <ProFormText
                name="url"
                placeholder="https://..."
                rules={[
                  { required: true, message: "请输入 URL" },
                  { type: "url", message: "URL 格式不正确" },
                ]}
              />
              <ProFormText name="sizeBytes" placeholder="字节数（可选）" />
            </div>
          </ProFormList>
        </ProForm>
      </Card>
    </PageContainer>
  );
}
