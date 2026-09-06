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
 * Self-service session management: merged view — live sessions from Redis
 * first (the current one highlighted + badged 本机), then up to 20 historical
 * tombstones from
 * the audit table (已登出 = explicit logout, 已失效 = TTL lapsed or evicted).
 * Revoking only applies to live rows.
 */
const STATUS_TAG: Record<string, { color: string; text: string }> = {
  SESSION_STATUS_ACTIVE: { color: "green", text: "活跃" },
  SESSION_STATUS_REVOKED: { color: "orange", text: "已登出" },
  SESSION_STATUS_EXPIRED: { color: "default", text: "已失效" },
};
export default function SessionPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);

  const columns: ProColumns<API.Session>[] = [
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (_, r) => {
        const tag = STATUS_TAG[r.status ?? ""];
        if (!tag) return null;
        return r.current ? (
          <>
            <Tag color={tag.color}>{tag.text}</Tag>
            <Tag color="blue">本机</Tag>
          </>
        ) : (
          <Tag color={tag.color}>{tag.text}</Tag>
        );
      },
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
    { title: "登录时间", dataIndex: "createdAt", valueType: "dateTime", width: 180 },
    { title: "最后活跃", dataIndex: "lastActiveAt", valueType: "dateTime", width: 180 },
    {
      title: "操作",
      valueType: "option",
      width: 100,
      render: (_, r) => [
        <Popconfirm
          key="revoke"
          title="吊销该会话？"
          disabled={r.current || r.status !== "SESSION_STATUS_ACTIVE"}
          onConfirm={async () => {
            await revokeSession({ sessionId: r.id ?? "" });
            message.success("已吊销");
            actionRef.current?.reload();
          }}
        >
          <Button
            type="link"
            danger
            disabled={r.current || r.status !== "SESSION_STATUS_ACTIVE"}
          >
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
        // Current row gets a soft green tint (antd green-1); no stylesheet in
        // this project, so the row style is applied inline.
        onRow={(r) => (r.current ? { style: { background: "#f6ffed" } } : {})}
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
