import {
  LoginForm,
  ProFormDependency,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import { App, Button, Collapse, Typography } from "antd";
import { history, useModel } from "@umijs/max";
import { useRef, useState } from "react";
import { GENDER_VALUE_ENUM } from "@/components/usertags";
import {
  register,
  sendVerificationCode,
} from "@/services/testkit/testkitService";

const { Link, Text } = Typography;

const USER_TYPE_INTERNAL = "USER_TYPE_INTERNAL";
const SENDER_ID = "testkit-web";

interface RegisterFormValues {
  channel?: "email" | "phone";
  email?: string;
  regionCode?: string;
  phone?: string;
  code?: string;
  captchaId?: string;
  username?: string;
  nickname?: string;
  password?: string;
  confirmPassword?: string;
  emailSubject?: string;
  emailBody?: string;
  emailHtmlBody?: string;
  smsTemplateId?: string;
  signName?: string;
  smsContent?: string;
  smsCodeParamKey?: string;
  gender?: string;
  timezone?: string;
  locale?: string;
}

/** Maps a form error (request lib shape) to its backend message. */
function bizMessage(err: unknown, fallback: string): string {
  const e = err as {
    data?: { message?: string };
    response?: { data?: { message?: string } };
  };
  return e?.data?.message ?? e?.response?.data?.message ?? fallback;
}

/**
 * Register page — mirrors user-service's registration surface (email OR
 * phone-code identity, delivery templates, initial profile) so the whole
 * downstream flow is exercisable from the UI.
 *
 * Delivery templates are REQUIRED by user-service (email: subject + body with
 * {code}; CN SMS: template_id + sign_name; international SMS: content with
 * {code}). They live in the collapsed 投递模板 panel with send-ready defaults —
 * replace with real vendor values once SMS/SMTP accounts are configured.
 *
 * Until accounts are configured the send step fails at the vendor layer, but
 * the code + captcha_id already sit in Redis (key captcha:1:<channel>:<target>)
 * — paste both into the form to complete registration without mail. When send
 * succeeds the captcha_id auto-fills from the response.
 */
export default function RegisterPage() {
  const { message } = App.useApp();
  const { setInitialState } = useModel("@@initialState");
  const formRef = useRef<ProFormInstance<RegisterFormValues>>();
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    const vals = formRef.current?.getFieldsValue() ?? {};
    const isEmail = vals.channel === "email";
    if (isEmail && !vals.email) {
      message.warning("请先填写邮箱");
      return;
    }
    if (!isEmail && (!vals.regionCode || !vals.phone)) {
      message.warning("请先填写国家码和手机号");
      return;
    }
    if (
      !isEmail &&
      vals.regionCode === "CN" &&
      (!vals.smsTemplateId || !vals.signName)
    ) {
      message.warning("国内短信需要短信模板 ID 和签名（投递模板面板里填写）");
      return;
    }
    setSending(true);
    try {
      const resp = await sendVerificationCode({
        channel: isEmail
          ? "VERIFICATION_CHANNEL_EMAIL"
          : "VERIFICATION_CHANNEL_SMS",
        purpose: "VERIFICATION_PURPOSE_REGISTER",
        senderId: SENDER_ID,
        ...(isEmail
          ? {
              email: vals.email,
              emailSubject: vals.emailSubject || "Testkit 验证码",
              emailBody: vals.emailBody || "您的验证码：{code}，5 分钟内有效。",
              emailHtmlBody: vals.emailHtmlBody || undefined,
            }
          : {
              regionCode: vals.regionCode || "CN",
              phone: vals.phone,
              smsTemplateId: vals.smsTemplateId || undefined,
              signName: vals.signName || undefined,
              smsContent: vals.smsContent || undefined,
              smsCodeParamKey: vals.smsCodeParamKey || undefined,
            }),
      });
      if (resp?.captchaId) {
        formRef.current?.setFieldValue("captchaId", resp.captchaId);
        message.success("验证码已发送，captcha_id 已自动填入");
      } else {
        message.success("验证码已发送");
      }
      startCountdown();
    } catch (err) {
      // Vendor-layer failure (SMTP/SMS account not configured): the code and
      // captcha_id are still in Redis — surface that path to the tester.
      message.error(
        bizMessage(err, "验证码发送失败") +
          "（邮件/短信未配置时可从 Redis 键 captcha:1:*:* 读取验证码与 captcha_id 手动填入）",
        6,
      );
    } finally {
      setSending(false);
    }
  };

  const sendButton = (
    <Button
      size="small"
      type="primary"
      ghost
      loading={sending}
      disabled={countdown > 0}
      onClick={sendCode}
    >
      {countdown > 0 ? `${countdown}s` : "发送验证码"}
    </Button>
  );

  return (
    <LoginForm<RegisterFormValues>
      formRef={formRef}
      title="Testkit"
      subTitle="注册新账号"
      initialValues={{
        channel: "email",
        regionCode: "CN",
        emailSubject: "Testkit 验证码",
        emailBody: "您的验证码：{code}，5 分钟内有效。",
        smsContent: "code: {code}",
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
      }}
      onFinish={async (vals) => {
        if (vals.password !== vals.confirmPassword) {
          message.error("两次输入的密码不一致");
          return false;
        }
        try {
          const data = await register({
            provider:
              vals.channel === "email"
                ? "IDENTITY_PROVIDER_EMAIL"
                : "IDENTITY_PROVIDER_PHONE",
            ...(vals.channel === "email"
              ? { email: vals.email }
              : { regionCode: vals.regionCode, phone: vals.phone }),
            code: vals.code,
            captchaId: vals.captchaId,
            username: vals.username,
            nickname: vals.nickname,
            password: vals.password,
            gender: vals.gender as API.v1Gender | undefined,
            timezone: vals.timezone,
            locale: vals.locale,
          });
          const token = data?.token;
          const user = data?.user;
          if (!token || !user) {
            message.error("注册失败：响应缺少 token 或用户信息");
            return false;
          }
          localStorage.setItem("testkit_token", token);
          localStorage.setItem("testkit_user", JSON.stringify(user));
          // Refresh initialState so the access plugin re-evaluates (it reads
          // the stored user) before the client-side redirect below.
          await setInitialState({ currentUser: user });
          message.success(`注册成功，欢迎 ${user.nickname || user.username}`);
          history.push(
            user.userType === USER_TYPE_INTERNAL ? "/dashboard" : "/profile",
          );
          return true;
        } catch (err) {
          message.error(bizMessage(err, "注册失败"));
          return false;
        }
      }}
    >
      <ProFormSelect
        name="channel"
        label="注册方式"
        options={[
          { value: "email", label: "邮箱注册" },
          { value: "phone", label: "手机号注册" },
        ]}
        rules={[{ required: true }]}
      />

      <ProFormDependency name={["channel"]}>
        {({ channel }) =>
          channel === "phone" ? (
            <>
              <ProFormText
                name="regionCode"
                label="国家码"
                placeholder="CN"
                rules={[{ required: true, message: "请输入两位国家码" }]}
              />
              <ProFormText
                name="phone"
                label="手机号"
                placeholder="13800138000（不带 +86）"
                rules={[{ required: true, message: "请输入手机号" }]}
              />
            </>
          ) : (
            <ProFormText
              name="email"
              label="邮箱"
              placeholder="user@example.com"
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "邮箱格式不正确" },
              ]}
            />
          )
        }
      </ProFormDependency>

      <ProFormText
        name="code"
        label="验证码"
        placeholder="邮件 / 短信中的验证码"
        rules={[{ required: true, message: "请输入验证码" }]}
        addonAfter={sendButton}
      />
      <ProFormText
        name="captchaId"
        label="captcha_id"
        placeholder="发送成功自动填入；未配置邮件/短信时从 Redis 键 captcha:1:*:* 读取"
        rules={[{ required: true, message: "请输入 captcha_id" }]}
      />

      <ProFormText
        name="username"
        label="用户名"
        placeholder="登录用户名"
        rules={[{ required: true, message: "请输入用户名" }]}
      />
      <ProFormText name="nickname" label="昵称" placeholder="显示昵称" />
      <ProFormText.Password
        name="password"
        label="密码"
        placeholder="至少 8 位"
        rules={[
          { required: true, message: "请输入密码" },
          { min: 8, message: "密码至少 8 位" },
        ]}
      />
      <ProFormText.Password
        name="confirmPassword"
        label="确认密码"
        placeholder="再输入一次密码"
        rules={[{ required: true, message: "请再次输入密码" }]}
      />

      <Collapse
        ghost
        items={[
          {
            key: "delivery",
            label: "投递模板（测试参数，user-service 校验必填项）",
            children: (
              <ProFormDependency name={["channel", "regionCode"]}>
                {({ channel, regionCode }) =>
                  channel === "phone" ? (
                    regionCode === "CN" ? (
                      <>
                        <ProFormText
                          name="smsTemplateId"
                          label="短信模板 ID"
                          placeholder="国内短信必填（厂商预注册模板）"
                        />
                        <ProFormText
                          name="signName"
                          label="短信签名"
                          placeholder="国内短信必填（监管要求）"
                        />
                        <ProFormText
                          name="smsCodeParamKey"
                          label="验证码参数名"
                          placeholder="默认 code"
                        />
                      </>
                    ) : (
                      <ProFormText
                        name="smsContent"
                        label="短信内容（国际通道）"
                        placeholder="code: {code}"
                      />
                    )
                  ) : (
                    <>
                      <ProFormText
                        name="emailSubject"
                        label="邮件主题"
                        placeholder="Testkit 验证码"
                      />
                      <ProFormText
                        name="emailBody"
                        label="邮件正文（纯文本）"
                        placeholder="您的验证码：{code}，5 分钟内有效。"
                      />
                      <ProFormText
                        name="emailHtmlBody"
                        label="邮件正文（HTML，可选）"
                        placeholder="<p>验证码：{code}</p>"
                      />
                    </>
                  )
                }
              </ProFormDependency>
            ),
          },
          {
            key: "profile",
            label: "更多资料（可选）",
            children: (
              <>
                <ProFormSelect
                  name="gender"
                  label="性别"
                  valueEnum={GENDER_VALUE_ENUM}
                />
                <ProFormText
                  name="timezone"
                  label="时区"
                  placeholder="Asia/Shanghai"
                />
                <ProFormText name="locale" label="语言" placeholder="zh-CN" />
              </>
            ),
          },
        ]}
      />

      <div
        style={{
          marginBlockEnd: 24,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Text type="secondary">邮箱 / 手机号注册</Text>
        <Link onClick={() => history.push("/user/login")}>返回登录</Link>
      </div>
    </LoginForm>
  );
}
