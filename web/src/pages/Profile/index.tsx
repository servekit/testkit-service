import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Space } from 'antd';
import { history } from '@umijs/max';

function readUser(): API.User | undefined {
  try {
    const raw = localStorage.getItem('testkit_user');
    return raw ? (JSON.parse(raw) as API.User) : undefined;
  } catch {
    return undefined;
  }
}

/** Self-service landing for any logged-in user (incl. internal). Real profile arrives P2. */
export default function ProfilePage() {
  const user = readUser();
  const logout = () => {
    localStorage.removeItem('testkit_token');
    localStorage.removeItem('testkit_user');
    history.push('/user/login');
  };
  return (
    <PageContainer
      header={{
        title: '个人中心',
        extra: [
          <Button key="logout" onClick={logout}>
            退出登录
          </Button>,
        ],
      }}
    >
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="普通用户后端首页（占位）"
            description="P2 会在此填充个人资料 / 身份 / 会话 / 我的文件 等自助能力。"
          />
          <Descriptions title="当前登录用户" column={1} bordered>
            <Descriptions.Item label="用户名">
              {user?.username || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="昵称">
              {user?.nickname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">
              {user?.email || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="user_type">
              {user?.userType || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </ProCard>
    </PageContainer>
  );
}
