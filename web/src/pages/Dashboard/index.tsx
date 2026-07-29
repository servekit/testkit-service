import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Space, Typography } from 'antd';
import { history } from '@umijs/max';

const { Paragraph } = Typography;

/** Internal back-office landing. Real dashboard arrives P5. */
export default function DashboardPage() {
  const logout = () => {
    localStorage.removeItem('testkit_token');
    localStorage.removeItem('testkit_user');
    history.push('/user/login');
  };
  return (
    <PageContainer
      header={{
        title: '工作台',
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
            message="内部后台管理首页（占位）"
            description="P2–P5 会在此填充用户 / 文件 / 消息 / gid 等运营管理能力。"
          />
          <Paragraph type="secondary">
            当前仅为 P1 骨架：登录闭环 + ProLayout + 两轨 access 已就绪。
          </Paragraph>
        </Space>
      </ProCard>
    </PageContainer>
  );
}
