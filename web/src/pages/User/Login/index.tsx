import { LoginForm, ProFormText } from "@ant-design/pro-components";
import { App, Typography } from "antd";
import { history, useModel } from "@umijs/max";
import { login } from "@/services/testkit/testkitService";

const { Link, Text } = Typography;

const USER_TYPE_INTERNAL = "USER_TYPE_INTERNAL";

/**
 * Login page — uses the GENERATED `login` service (no hand-written fetch).
 * On success: persist token + user, then redirect by user_type
 * (INTERNAL -> /dashboard back-office, NORMAL -> /profile self-service).
 *
 * regionCode defaults to 'CN' because the backend's LoginRequest validates
 * region_code against ^[A-Z]{2}$ even when empty (no ignore_empty), which would
 * otherwise reject username/password logins at validation before the business
 * layer (USER_NOT_FOUND). Flagged as a backend validation quirk for follow-up.
 */
export default function LoginPage() {
  const { message } = App.useApp();
  const { setInitialState } = useModel("@@initialState");

  return (
    <LoginForm<{ username: string; password: string }>
      title="Testkit"
      subTitle="后台管理系统"
      onFinish={async (vals) => {
        try {
          const data = await login({
            method: "LOGIN_METHOD_USERNAME_PASSWORD",
            username: vals.username,
            password: vals.password,
            dialCode: "+86",
          });

          const token = data?.token;
          const user = data?.user;
          if (!token || !user) {
            message.error("登录失败：响应缺少 token 或用户信息");
            return false;
          }
          localStorage.setItem("testkit_token", token);
          localStorage.setItem("testkit_user", JSON.stringify(user));
          // Refresh initialState so the access plugin re-evaluates (it reads
          // the stored user) before the client-side redirect below.
          await setInitialState({ currentUser: user });
          message.success("登录成功");
          history.push(
            user.userType === USER_TYPE_INTERNAL ? "/dashboard" : "/profile",
          );
          return true;
        } catch (err) {
          // 401 is handled by the request interceptor (clears session, redirects
          // to login). Other failures (e.g. USER_NOT_FOUND -> HTTP 404) surface
          // their backend message here so the wiring is observable end-to-end.
          const e = err as {
            data?: { message?: string };
            response?: { data?: { message?: string } };
          };
          const businessMessage =
            e?.data?.message ?? e?.response?.data?.message ?? "登录失败";
          message.error(businessMessage);
          return false;
        }
      }}
    >
      <ProFormText
        name="username"
        placeholder="用户名"
        rules={[{ required: true, message: "请输入用户名" }]}
      />
      <ProFormText.Password
        name="password"
        placeholder="密码"
        rules={[{ required: true, message: "请输入密码" }]}
      />
      <div
        style={{
          marginBlockEnd: 24,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Text type="secondary">用户名密码登录</Text>
        <span>
          <Link
            style={{ marginInlineEnd: 12 }}
            onClick={() => history.push("/user/register")}
          >
            注册账号
          </Link>
          <Link>忘记密码</Link>
        </span>
      </div>
    </LoginForm>
  );
}
