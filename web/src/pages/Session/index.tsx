import { PageContainer } from "@ant-design/pro-components";
import { App, Button, Popconfirm, Segmented, Space, Table, Tag, type TableColumnsType } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  listSessions,
  revokeAllSessions,
  revokeSession,
} from "@/services/testkit/testkitService";
import { DEVICE_TYPE_VALUE_ENUM } from "@/components/usertags";
import dayjs from "dayjs";

const PAGE_SIZE = 20;

/**
 * Self-service session management: merged view, progressively loaded. The
 * first page carries the live sessions from Redis (the current one
 * highlighted + badged 本机) ahead of the first history batch; 加载更多 pages
 * PG tombstones (已登出 = explicit logout, 已失效 = TTL lapsed or evicted)
 * strictly older via the backend cursor. Revoking only applies to live rows.
 */
const STATUS_TAG: Record<string, { color: string; text: string }> = {
  SESSION_STATUS_ACTIVE: { color: "green", text: "活跃" },
  SESSION_STATUS_REVOKED: { color: "orange", text: "已登出" },
  SESSION_STATUS_EXPIRED: { color: "default", text: "已失效" },
};

type StatusFilter = "" | "SESSION_STATUS_ACTIVE" | "SESSION_STATUS_REVOKED" | "SESSION_STATUS_EXPIRED";

export default function SessionPage() {
  const { message } = App.useApp();
  const [sessions, setSessions] = useState<API.Session[]>([]);
  const [nextCursor, setNextCursor] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("");

  const loadPage = useCallback(async (cursor: string, st: StatusFilter) => {
    setLoading(true);
    try {
      const resp = await listSessions({
        pageSize: PAGE_SIZE,
        cursor: cursor || undefined,
        status: (st || undefined) as API.ListSessionsParams["status"],
      });
      const page = resp.sessions ?? [];
      setSessions((prev) => (cursor ? [...prev, ...page] : page));
      setNextCursor(resp.nextCursor ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  // First page on mount and on filter change; revoke/revoke-all reset too.
  useEffect(() => {
    void loadPage("", status);
  }, [loadPage, status]);

  const columns: TableColumnsType<API.Session> = [
    {
      title: "状态",
      dataIndex: "status",
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
      title: "设备",
      dataIndex: "deviceType",
      width: 100,
      render: (_, r) => DEVICE_TYPE_VALUE_ENUM[r.deviceType ?? ""]?.text ?? "-",
    },
    { title: "IP", dataIndex: "ip", width: 140 },
    { title: "系统", dataIndex: "os", width: 120 },
    { title: "客户端", dataIndex: "browser" },
    {
      title: "位置",
      render: (_, r) => [r.country, r.city].filter(Boolean).join(" ") || "-",
    },
    {
      title: "登录时间",
      dataIndex: "createdAt",
      width: 180,
      render: (v) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : "-"),
    },
    {
      title: "最后活跃",
      dataIndex: "lastActiveAt",
      width: 180,
      render: (v) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : "-"),
    },
    {
      title: "操作",
      width: 100,
      render: (_, r) => (
        <Popconfirm
          title="吊销该会话？"
          disabled={r.current || r.status !== "SESSION_STATUS_ACTIVE"}
          onConfirm={async () => {
            await revokeSession({ sessionId: r.id ?? "" });
            message.success("已吊销");
            void loadPage("", status);
          }}
        >
          <Button
            type="link"
            danger
            disabled={r.current || r.status !== "SESSION_STATUS_ACTIVE"}
          >
            吊销
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <PageContainer>
      <Space style={{ marginBottom: 16 }}>
        <Segmented
          value={status || "all"}
          onChange={(v) => setStatus(v === "all" ? "" : (v as StatusFilter))}
          options={[
            { value: "all", label: "全部" },
            { value: "SESSION_STATUS_ACTIVE", label: "活跃" },
            { value: "SESSION_STATUS_REVOKED", label: "已登出" },
            { value: "SESSION_STATUS_EXPIRED", label: "已失效" },
          ]}
        />
        <Popconfirm
          title="登出所有其他设备？"
          onConfirm={async () => {
            await revokeAllSessions();
            message.success("已登出所有设备");
            void loadPage("", status);
          }}
        >
          <Button danger>登出所有其他设备</Button>
        </Popconfirm>
      </Space>
      <Table<API.Session>
        columns={columns}
        rowKey="id"
        dataSource={sessions}
        loading={loading}
        // Current row gets a soft green tint (antd green-1); no stylesheet
        // in this project, so the row style is applied inline.
        onRow={(r) => (r.current ? { style: { background: "#e6f4ff" } } : {})}
        pagination={false}
        footer={() => (
          <Space>
            <span>已加载 {sessions.length} 条</span>
            {nextCursor ? (
              <Button
                type="link"
                loading={loading}
                onClick={() => void loadPage(nextCursor, status)}
              >
                加载更多
              </Button>
            ) : (
              <span>· 没有更多了</span>
            )}
          </Space>
        )}
      />
    </PageContainer>
  );
}
