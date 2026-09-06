import {
  PageContainer,
  ProTable,
  type ProColumns,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Tag } from "antd";
import { useRef } from "react";
import type { ActionType } from "@ant-design/pro-components";
import {
  listSessions,
  revokeAllSessions,
  revokeSession,
} from "@/services/testkit/testkitService";
import { DEVICE_TYPE_VALUE_ENUM } from "@/components/usertags";

/**
 * Self-service session management. Lists the caller's active sessions
 * (the current one is flagged), with per-session revoke and revoke-all.
 */
export default function SessionPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);

  const columns: ProColumns<API.Session>[] = [
    {
      title: "当前",
      dataIndex: "current",
      width: 80,
      render: (_, r) => (r.current ? <Tag color="green">本机</Tag> : null),
    },
    {
      title: "设备",
      dataIndex: "deviceType",
      valueType: "select",
      valueEnum: DEVICE_TYPE_VALUE_ENUM,
      width: 100,
    },
    { title: "IP", dataIndex: "ip", width: 140 },
    { title: "系统", dataIndex: "os", width: 120 },
    { title: "浏览器", dataIndex: "browser" },
    {
      title: "位置",
      render: (_, r) => [r.country, r.city].filter(Boolean).join(" ") || "-",
    },
    { title: "最后活跃", dataIndex: "lastActiveAt", valueType: "dateTime", width: 180 },
    {
      title: "操作",
      valueType: "option",
      width: 100,
      render: (_, r) => [
        <Popconfirm
          key="revoke"
          title="吊销该会话？"
          disabled={r.current}
          onConfirm={async () => {
            await revokeSession({ sessionId: r.id ?? "" });
            message.success("已吊销");
            actionRef.current?.reload();
          }}
        >
          <Button type="link" danger disabled={r.current}>
            吊销
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.Session>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        headerTitle="登录会话"
        request={async () => {
          const resp = await listSessions();
          return { data: resp.sessions ?? [], success: true };
        }}
        toolBarRender={() => [
          <Popconfirm
            key="revoke-all"
            title="登出所有其他设备？"
            onConfirm={async () => {
              await revokeAllSessions();
              message.success("已登出所有设备");
              actionRef.current?.reload();
            }}
          >
            <Button danger>登出所有设备</Button>
          </Popconfirm>,
        ]}
      />
    </PageContainer>
  );
}
