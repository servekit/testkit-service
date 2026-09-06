import { PageContainer, ProTable, type ProColumns } from "@ant-design/pro-components";
import { spinReload } from "@/components/TableOptions";
import { App, Button, Popconfirm, Tag } from "antd";
import dayjs from "dayjs";
import {
  listSessions,
  revokeAllSessions,
  revokeSession,
} from "@/services/testkit/testkitService";
import { useCursorTable } from "@/components/CursorPager";
import { DEVICE_TYPE_VALUE_ENUM, PROVIDER_VALUE_ENUM, loginMethodLabel } from "@/components/usertags";

const ACTIVE = "SESSION_STATUS_ACTIVE";

/** Status filter options + row tags; the current session renders specially. */
const STATUS_VALUE_ENUM: Record<string, { text: string }> = {
  SESSION_STATUS_ACTIVE: { text: "活跃" },
  SESSION_STATUS_REVOKED: { text: "已登出" },
  SESSION_STATUS_EXPIRED: { text: "已失效" },
};

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  SESSION_STATUS_ACTIVE: { color: "green", text: "活跃" },
  SESSION_STATUS_REVOKED: { color: "orange", text: "已登出" },
  SESSION_STATUS_EXPIRED: { color: "default", text: "已失效" },
};

/**
 * Self-service session management. Backend pagination is cursor-based
 * (live Redis rows first, then PG tombstones strictly older), so the ProTable
 * request runs through useCursorTable (progressive prev/next paging).
 * Revoking applies to live rows only; 登出所有其他设备 spares the caller's
 * current session (exclude_session_id injected at the edge).
 */
export default function SessionPage() {
  const { message } = App.useApp();
  const sessions = useCursorTable(async ({ cursor, pageSize, status }) => {
    const resp = await listSessions({
      pageSize,
      cursor: cursor || undefined,
      status: status as API.ListSessionsParams["status"],
    });
    return { items: resp.sessions, nextCursor: resp.nextCursor };
  });

  const columns: ProColumns<API.Session>[] = [
    {
      title: "状态",
      dataIndex: "status",
      valueType: "select",
      valueEnum: STATUS_VALUE_ENUM,
      width: 130,
      // The caller's own row gets a single distinct 当前会话 tag (geekblue)
      // plus the row tint below — no extra badge crammed into the cell.
      render: (_, r) => {
        if (r.current) return <Tag color="geekblue">当前会话</Tag>;
        const tag = STATUS_TAG[r.status ?? ""];
        return tag ? <Tag color={tag.color}>{tag.text}</Tag> : null;
      },
    },
    {
      title: "登录方式",
      dataIndex: "loginMethod",
      search: false,
      width: 170,
      // e.g. 邮箱验证码 · x@y.com — sensitive ops gate on this strength.
      render: (_, r) => (
        <div>
          {/* Credential logins show the method; social/mini-program rows have
              no LoginMethod (UNSPECIFIED) and show the IdP instead. */}
          <div>
            {r.loginMethod && r.loginMethod !== "LOGIN_METHOD_UNSPECIFIED"
              ? loginMethodLabel(r.loginMethod)
              : PROVIDER_VALUE_ENUM[r.loginProvider as keyof typeof PROVIDER_VALUE_ENUM]?.text ?? "-"}
          </div>
          {r.loginTarget ? (
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>{r.loginTarget}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "设备",
      dataIndex: "device",
      search: false,
      width: 110,
      // Hardware name when known (iPhone/Android model/client hint);
      // degrade to the kind label for desktop web / API clients.
      render: (_, r) =>
        r.device ||
        DEVICE_TYPE_VALUE_ENUM[r.deviceType as keyof typeof DEVICE_TYPE_VALUE_ENUM]?.text ||
        "-",
    },
    { title: "IP", dataIndex: "ip", search: false, width: 140 },
    { title: "系统", dataIndex: "os", search: false, width: 120 },
    { title: "User-Agent", dataIndex: "browser", search: false },
    {
      title: "位置",
      search: false,
      render: (_, r) => [r.country, r.city].filter(Boolean).join(" ") || "-",
    },
    {
      title: "登录时间",
      dataIndex: "createdAt",
      search: false,
      width: 180,
      render: (_, r) => fmt(r.createdAt),
    },
    {
      title: "最后活跃",
      dataIndex: "lastActiveAt",
      search: false,
      width: 180,
      render: (_, r) => fmt(r.lastActiveAt),
    },
    {
      title: "操作",
      valueType: "option",
      width: 90,
      render: (_, r) => [
        <Popconfirm
          key="revoke"
          title="吊销该会话？"
          disabled={r.current || r.status !== ACTIVE}
          onConfirm={async () => {
            await revokeSession({ sessionId: r.id ?? "" });
            message.success("已吊销");
            sessions.actionRef.current?.reload();
          }}
        >
          <Button
            type="link"
            danger
            disabled={r.current || r.status !== ACTIVE}
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
        actionRef={sessions.actionRef}
        columns={columns}
        rowKey="id"
        search={{ labelWidth: "auto" }}
        pagination={false}
        options={spinReload}
        request={sessions.request}
        footer={() => sessions.pager}
        toolBarRender={() => [
          <Popconfirm
            key="revoke-all"
            title="登出所有其他设备？"
            onConfirm={async () => {
              await revokeAllSessions();
              message.success("已登出其他设备");
              sessions.actionRef.current?.reload();
            }}
          >
            <Button danger>登出所有其他设备</Button>
          </Popconfirm>,
        ]}
      />
    </PageContainer>
  );
}

/** Render an RFC3339 timestamp in the browser's timezone. */
function fmt(v?: string): string {
  return v ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : "-";
}
