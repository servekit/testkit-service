import {
  ModalForm,
  ProFormDependency,
  PageContainer,
  ProTable,
  ProFormSelect,
  ProFormText,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { spinReload } from "@/components/TableOptions";
import { App, Button, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRef, useState } from "react";
import {
  bindIdentity,
  bindOAuthIdentity,
  getOAuthUrl,
  listIdentities,
  sendVerificationCode,
  unbindIdentity,
} from "@/services/testkit/testkitService";
import { useRegionOptions } from "@/hooks/useRegionOptions";

const OAUTH_PROVIDERS = [
  "IDENTITY_PROVIDER_GITHUB",
  "IDENTITY_PROVIDER_GOOGLE",
  "IDENTITY_PROVIDER_WECHAT",
  "IDENTITY_PROVIDER_APPLE",
];
const BIND_PROVIDER_OPTIONS = [
  { value: "IDENTITY_PROVIDER_EMAIL", label: "邮箱" },
  { value: "IDENTITY_PROVIDER_PHONE", label: "手机" },
  { value: "IDENTITY_PROVIDER_GITHUB", label: "GitHub" },
  { value: "IDENTITY_PROVIDER_GOOGLE", label: "Google" },
  { value: "IDENTITY_PROVIDER_WECHAT", label: "微信" },
  { value: "IDENTITY_PROVIDER_APPLE", label: "Apple" },
];
import { VERIFICATION_CODE_TEMPLATE } from "@/utils/emailTemplates";
import { PROVIDER_VALUE_ENUM } from "@/components/usertags";

/**
 * Self-service identity (login-method) management.
 * List the caller's bound identities, bind a new email/phone, unbind by id.
 * user_id is injected from ctx on the backend — not present in the request.
 */
export default function IdentityPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [bindOpen, setBindOpen] = useState(false);
  const [unbindTarget, setUnbindTarget] = useState<API.Identity | null>(null);
  const [oauthState, setOauthState] = useState<string | undefined>();
  const [oauthUrl, setOauthUrl] = useState<string | undefined>();
  const regionOptions = useRegionOptions();

  const columns: ProColumns<API.Identity>[] = [
    {
      title: "ID",
      dataIndex: "id",
      width: 200,
    },
    {
      title: "提供方",
      dataIndex: "provider",
      valueType: "select",
      valueEnum: PROVIDER_VALUE_ENUM,
      width: 140,
    },
    { title: "标识", dataIndex: "providerUid" },
    {
      title: "已验证",
      dataIndex: "verified",
      width: 100,
      render: (_, r) =>
        r.verified ? <Tag color="green">已验证</Tag> : <Tag>未验证</Tag>,
    },
    {
      title: "绑定时间",
      dataIndex: "createdAt",
      valueType: "dateTime",
      width: 180,
    },
    {
      title: "操作",
      valueType: "option",
      width: 100,
      render: (_, r) => {
        // EMAIL/PHONE 解绑需验证码；OAuth 身份凭证在第三方，登录会话即
        // 凭证，可直接解绑；ADMIN 是创建来源审计标记，不可解绑（与后端
        // UnbindIdentity 的分支一致）。
        const provider = r.provider ?? "";
        const codeUnbindable =
          provider === "IDENTITY_PROVIDER_EMAIL" ||
          provider === "IDENTITY_PROVIDER_PHONE";
        const oauthUnbindable = [
          "IDENTITY_PROVIDER_GITHUB",
          "IDENTITY_PROVIDER_GOOGLE",
          "IDENTITY_PROVIDER_WECHAT",
          "IDENTITY_PROVIDER_WECHAT_MINIPROGRAM",
          "IDENTITY_PROVIDER_APPLE",
        ].includes(provider);
        const unbindable = codeUnbindable || oauthUnbindable;
        return [
          <Button
            key="unbind"
            type="link"
            danger
            disabled={!unbindable}
            onClick={() => setUnbindTarget(r)}
          >
            解绑
          </Button>,
        ];
      },
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.Identity>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        headerTitle="已绑定的身份"
        options={spinReload}
        request={async () => {
          const resp = await listIdentities();
          return { data: resp.identities ?? [], success: true };
        }}
        toolBarRender={() => [
          <Button
            key="bind"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setBindOpen(true)}
          >
            绑定
          </Button>,
        ]}
      />
      <ModalForm
        title="绑定身份"
        open={bindOpen}
        onOpenChange={(open) => {
          setBindOpen(open);
          if (!open) {
            setOauthState(undefined);
            setOauthUrl(undefined);
          }
        }}
        onFinish={async (vals) => {
          const isOAuth = OAUTH_PROVIDERS.includes(vals.provider ?? "");
          if (isOAuth) {
            await bindOAuthIdentity({
              provider: vals.provider,
              code: vals.code,
              state: oauthState ?? "",
            });
            message.success("OAuth 身份已绑定");
          } else {
            await bindIdentity({
              provider: vals.provider,
              email: vals.email,
              regionCode: vals.regionCode,
              phone: vals.phone,
              code: vals.code,
            });
            message.success("绑定成功");
          }
          setOauthState(undefined);
          setOauthUrl(undefined);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="provider"
          label="提供方"
          rules={[{ required: true, message: "请选择提供方" }]}
          options={BIND_PROVIDER_OPTIONS}
        />
        <ProFormDependency name={["provider"]}>
          {({ provider }: { provider?: string }) => {
            if (OAUTH_PROVIDERS.includes(provider ?? "")) {
              return (
                <>
                  <Typography.Paragraph type="secondary">
                    OAuth 凭证由第三方托管：先获取授权链接并在第三方完成授权，回调带来的
                    code 填到下方（state 已自动携带）。
                  </Typography.Paragraph>
                  <Button
                    onClick={async () => {
                      try {
                        const resp = await getOAuthUrl({
                          provider: (provider ?? "") as API.GetOAuthURLParams["provider"],
                          returnTo: "/identity",
                        });
                        setOauthState(resp.state ?? "");
                        setOauthUrl(resp.url ?? "");
                      } catch (e) {
                        const err = e as { data?: { message?: string } };
                        message.error(err?.data?.message ?? "获取授权链接失败");
                      }
                    }}
                  >
                    获取授权链接
                  </Button>
                  {oauthUrl && (
                    <Typography.Paragraph style={{ marginTop: 8 }} copyable={{ text: oauthUrl }}>
                      <a href={oauthUrl} target="_blank" rel="noreferrer">
                        {oauthUrl.slice(0, 80)}…
                      </a>
                    </Typography.Paragraph>
                  )}
                  <ProFormText
                    name="code"
                    label="授权码"
                    placeholder="第三方回调 ?code=… 的值"
                    rules={[{ required: true, message: "请输入授权码" }]}
                  />
                </>
              );
            }
            const isEmail = provider === "IDENTITY_PROVIDER_EMAIL";
            const isPhone = provider === "IDENTITY_PROVIDER_PHONE";
            return (
              <>
                {isEmail && <ProFormText name="email" label="邮箱" placeholder="绑定邮箱" />}
                {isPhone && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <ProFormSelect
                      name="regionCode"
                      label="区号"
                      initialValue="CN"
                      fieldProps={{
                        showSearch: true,
                        optionFilterProp: "label",
                        style: { width: 160 },
                      }}
                      options={regionOptions}
                    />
                    <ProFormText
                      name="phone"
                      label="手机号"
                      placeholder="本地号码，无 +"
                      fieldProps={{ style: { flex: 1 } }}
                    />
                  </div>
                )}
                {(isEmail || isPhone) && (
                  <ProFormDependency name={["email", "regionCode", "phone"]}>
                    {({ email, regionCode, phone }) => (
                      <Button
                        onClick={async () => {
                          try {
                            await sendVerificationCode({
                              channel: isEmail
                                ? "VERIFICATION_CHANNEL_EMAIL"
                                : "VERIFICATION_CHANNEL_SMS",
                              purpose: "VERIFICATION_PURPOSE_BIND",
                              senderId: "testkit-web",
                              ...(isEmail
                                ? {
                                    email: email ?? "",
                                    emailSubject: VERIFICATION_CODE_TEMPLATE.subject,
                                    emailBody: VERIFICATION_CODE_TEMPLATE.body,
                                  }
                                : { regionCode: regionCode || "CN", phone: phone ?? "" }),
                            });
                            message.success("验证码已发送");
                          } catch (e) {
                            const err = e as { data?: { message?: string } };
                            message.error(err?.data?.message ?? "发送失败");
                          }
                        }}
                      >
                        发送验证码
                      </Button>
                    )}
                  </ProFormDependency>
                )}
                {(isEmail || isPhone) && (
                  <ProFormText
                    name="code"
                    label="验证码"
                    rules={[{ required: true, message: "请输入验证码" }]}
                    fieldProps={{ maxLength: 6 }}
                  />
                )}
              </>
            );
          }}
        </ProFormDependency>
      </ModalForm>

      {unbindTarget && (
        <ModalForm<{ code: string }>
          title={`解绑 ${PROVIDER_VALUE_ENUM[unbindTarget.provider as keyof typeof PROVIDER_VALUE_ENUM]?.text ?? unbindTarget.provider} 身份`}
          open
          onOpenChange={(open) => {
            if (!open) setUnbindTarget(null);
          }}
          modalProps={{ destroyOnClose: true }}
          onFinish={async (vals) => {
            const needsCode =
              unbindTarget.provider === "IDENTITY_PROVIDER_EMAIL" ||
              unbindTarget.provider === "IDENTITY_PROVIDER_PHONE";
            await unbindIdentity(
              { identityId: unbindTarget.id ?? "" },
              { code: needsCode ? vals.code : "" },
            );
            message.success("已解绑");
            setUnbindTarget(null);
            actionRef.current?.reload();
            return true;
          }}
        >
          <Typography.Paragraph type="secondary">
            将解绑 <b>{unbindTarget.providerUid}</b>
            ，解绑后该身份不能再用于登录。{unbindTarget.provider === "IDENTITY_PROVIDER_EMAIL" || unbindTarget.provider === "IDENTITY_PROVIDER_PHONE" ? "需验证码确认本人操作。" : "OAuth 凭证由第三方托管，确认后直接解绑。"}
          </Typography.Paragraph>
          {(unbindTarget.provider === "IDENTITY_PROVIDER_EMAIL" ||
            unbindTarget.provider === "IDENTITY_PROVIDER_PHONE") && (
            <>
              <ProFormText
                name="code"
                label="验证码"
                rules={[{ required: true, message: "请输入验证码" }]}
                fieldProps={{ maxLength: 6 }}
              />
              <Button
                onClick={async () => {
                  try {
                    const isEmail = unbindTarget.provider === "IDENTITY_PROVIDER_EMAIL";
                await sendVerificationCode({
                  channel: isEmail
                    ? "VERIFICATION_CHANNEL_EMAIL"
                    : "VERIFICATION_CHANNEL_SMS",
                  purpose: isEmail
                    ? "VERIFICATION_PURPOSE_VERIFY_EMAIL"
                    : "VERIFICATION_PURPOSE_VERIFY_PHONE",
                  senderId: "testkit-web",
                  ...(isEmail
                    ? {
                        email: unbindTarget.providerUid ?? "",
                        emailSubject: VERIFICATION_CODE_TEMPLATE.subject,
                        emailBody: VERIFICATION_CODE_TEMPLATE.body,
                      }
                    : { phone: unbindTarget.providerUid ?? "" }),
                });
                    message.success("验证码已发送");
                  } catch (e) {
                    const err = e as { data?: { message?: string } };
                    message.error(err?.data?.message ?? "发送失败");
                  }
                }}
              >
                发送验证码
              </Button>
            </>
          )}
        </ModalForm>
      )}
    </PageContainer>
  );
}
