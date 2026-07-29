import {
  ModalForm,
  PageContainer,
  ProCard,
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProFormSelect,
} from "@ant-design/pro-components";
import { App, Button, Descriptions, Space } from "antd";
import { history } from "@umijs/max";
import { useEffect, useState } from "react";
import {
  changePassword,
  getProfile,
  updateProfile,
} from "@/services/testkit/testkitService";
import { GENDER_VALUE_ENUM, UserTypeTag } from "@/components/usertags";

/**
 * Self-service profile page. Any logged-in user (incl. internal) lands here.
 * account-type is read-only (UserType tag, per design §3.5 — frontend route
 * split, not RBAC). Uses GENERATED services only (no hand-written fetch).
 */
export default function ProfilePage() {
  const { message } = App.useApp();
  const [user, setUser] = useState<API.User>();
  const [loaded, setLoaded] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getProfile()
      .then((u) => {
        if (alive) setUser(u);
      })
      .catch(() => {
        // 401 is handled by the request interceptor (clears session, redirects).
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("testkit_token");
    localStorage.removeItem("testkit_user");
    history.push("/user/login");
  };

  return (
    <PageContainer
      header={{
        title: "个人资料",
        extra: [
          <Button key="logout" onClick={logout}>
            退出登录
          </Button>,
        ],
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <ProCard title="账号信息" headerBordered>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="账号类型">
              <UserTypeTag userType={user?.userType} />
            </Descriptions.Item>
            <Descriptions.Item label="用户名">
              {user?.username || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">
              {user?.email || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="手机">
              {user?.regionCode} {user?.phone}
            </Descriptions.Item>
          </Descriptions>
        </ProCard>

        <ProCard
          title="编辑资料"
          headerBordered
          extra={[
            <Button key="pwd" onClick={() => setPwdOpen(true)}>
              修改密码
            </Button>,
          ]}
        >
          {/* `key` remounts the form once the profile loads so initialValues apply. */}
          <ProForm<API.UpdateProfileRequest>
            key={loaded ? "loaded" : "empty"}
            initialValues={user}
            onFinish={async (vals) => {
              const u = await updateProfile(vals);
              setUser(u);
              message.success("已保存");
              return true;
            }}
            submitter={{ searchConfig: { submitText: "保存" } }}
          >
            <ProFormText
              name="username"
              label="用户名"
              placeholder="请输入用户名"
            />
            <ProFormText
              name="nickname"
              label="昵称"
              placeholder="请输入昵称"
            />
            <ProFormText
              name="realName"
              label="真实姓名"
              placeholder="请输入真实姓名"
            />
            <ProFormText
              name="avatarUrl"
              label="头像 URL"
              placeholder="https://..."
            />
            <ProFormSelect
              name="gender"
              label="性别"
              valueEnum={GENDER_VALUE_ENUM}
            />
            <ProFormText
              name="birthday"
              label="生日"
              placeholder="YYYY-MM-DD"
            />
            <ProFormText
              name="timezone"
              label="时区"
              placeholder="Asia/Shanghai"
            />
            <ProFormText name="locale" label="语言" placeholder="zh-CN" />
            <ProFormTextArea
              name="bio"
              label="简介"
              fieldProps={{ maxLength: 512, showCount: true }}
            />
          </ProForm>
        </ProCard>
      </Space>

      <ModalForm
        title="修改密码"
        open={pwdOpen}
        onOpenChange={setPwdOpen}
        onFinish={async (vals) => {
          await changePassword({
            oldPassword: vals.oldPassword,
            newPassword: vals.newPassword,
          });
          message.success("密码已修改");
          return true;
        }}
      >
        <ProFormText.Password
          name="oldPassword"
          label="当前密码"
          rules={[{ required: true, message: "请输入当前密码" }]}
        />
        <ProFormText.Password
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: "请输入新密码" },
            { min: 8, message: "至少 8 位" },
          ]}
        />
      </ModalForm>
    </PageContainer>
  );
}
