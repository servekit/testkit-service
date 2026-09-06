import {
  PageContainer,
  ProFormSelect,
  ProFormText,
  QueryFilter,
} from "@ant-design/pro-components";
import { Button, Space, Table, Tag, Typography, type TableColumnsType } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { getLoginLogs } from "@/services/testkit/testkitService";
import {
  DEVICE_TYPE_VALUE_ENUM,
  LOGIN_ACTION_VALUE_ENUM,
  LOGIN_METHOD_VALUE_ENUM,
} from "@/components/usertags";

/** Shape of the QueryFilter output; values arrive as strings. */
interface AuditFilters {
  userId?: string;
  username?: string;
  method?: API.GetLoginLogsParams["method"];
  action?: API.GetLoginLogsParams["action"];
  success?: "true" | "false";
}

const PAGE_SIZE = 50;

function toEnumOptions(
  valueEnum: Record<string, { text: string }>,
): { value: string; label: string }[] {
  return Object.entries(valueEnum).map(([value, { text }]) => ({ value, label: text }));
}

/**
 * Auth audit log (login/register attempts — the backend table also records
 * social/binding events, hence the page name 认证记录). The backend is
 * cursor-paginated (an audit table only grows, so cursor paging never skips
 * or repeats rows the way offset paging does under a steady write stream);
 * this page surfaces that as progressive loading: first page on filter
 * change, 加载更多 appends while next_cursor is non-empty.
 */
export default function LoginLogsPage() {
  const [logs, setLogs] = useState<API.LoginLog[]>([]);
  const [nextCursor, setNextCursor] = useState("");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<AuditFilters>({});

  async function loadPage(cursor: string, f: AuditFilters) {
    setLoading(true);
    try {
      const resp = await getLoginLogs({
        userId: f.userId || undefined,
        username: f.username || undefined,
        method: f.method,
        action: f.action,
        success: f.success === undefined ? undefined : f.success === "true",
        pageSize: PAGE_SIZE,
        cursor: cursor || undefined,
      });
      const page = resp.logs ?? [];
      setLogs((prev) => (cursor ? [...prev, ...page] : page));
      setNextCursor(resp.nextCursor ?? "");
    } finally {
      setLoading(false);
    }
  }

  // First page whenever the filters change; 加载更多 passes the cursor in.
  useEffect(() => {
    void loadPage("", filters);
  }, [filters]);

  const columns: TableColumnsType<API.LoginLog> = [
    { title: "时间", dataIndex: "createdAt", width: 180, render: (v) => dayjsLocal(v) },
    {
      title: "用户",
      dataIndex: "username",
      width: 170,
      // Username first, the snowflake id dimmed beneath (copy on click);
      // failed attempts on unknown targets fall back to the raw id.
      render: (_, r) => (
        <div>
          <div>{r.username || String(r.userId || "-")}</div>
          {r.username && r.userId ? (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12 }}
              copyable={{ text: String(r.userId), tooltips: ["复制 ID", "已复制"] }}
            >
              {String(r.userId)}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "登录方式",
      dataIndex: "method",
      width: 110,
      render: (_, r) => LOGIN_METHOD_VALUE_ENUM[r.method ?? ""]?.text ?? "-",
    },
    {
      title: "动作",
      dataIndex: "action",
      width: 100,
      render: (_, r) => LOGIN_ACTION_VALUE_ENUM[r.action ?? ""]?.text ?? "-",
    },
    {
      title: "结果",
      dataIndex: "success",
      width: 90,
      render: (_, r) =>
        r.success ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
    },
    { title: "IP", dataIndex: "ip", width: 140 },
    {
      title: "设备",
      dataIndex: "deviceType",
      width: 90,
      render: (_, r) => DEVICE_TYPE_VALUE_ENUM[r.deviceType ?? ""]?.text ?? "-",
    },
    {
      title: "位置",
      render: (_, r) => [r.country, r.city].filter(Boolean).join(" ") || "-",
    },
    {
      title: "失败原因",
      dataIndex: "failReason",
      render: (_, r) => {
        if (!r.failReason) return "-";
        // Audit codes stored by user-service; unknown codes pass through raw.
        const labels: Record<string, string> = {
          wrong_password: "密码错误",
          wrong_code: "验证码错误",
          verify_failed: "校验未通过",
        };
        return labels[r.failReason] ?? r.failReason;
      },
    },
  ];

  return (
    <PageContainer>
      <QueryFilter<AuditFilters>
        onFinish={async (values) => {
          setFilters(values);
        }}
        onReset={() => setFilters({})}
      >
        <ProFormText name="username" label="用户名" placeholder="按用户名过滤" />
        <ProFormText name="userId" label="用户 ID" placeholder="按用户 ID 过滤" />
        <ProFormSelect
          name="method"
          label="登录方式"
          options={toEnumOptions(LOGIN_METHOD_VALUE_ENUM)}
        />
        <ProFormSelect
          name="action"
          label="动作"
          options={toEnumOptions(LOGIN_ACTION_VALUE_ENUM)}
        />
        <ProFormSelect
          name="success"
          label="结果"
          options={[
            { value: "true", label: "成功" },
            { value: "false", label: "失败" },
          ]}
        />
      </QueryFilter>

      <Table<API.LoginLog>
        columns={columns}
        rowKey="id"
        dataSource={logs}
        loading={loading}
        pagination={false}
        footer={() => (
          <Space>
            <span>已加载 {logs.length} 条</span>
            {nextCursor ? (
              <Button
                type="link"
                loading={loading}
                onClick={() => void loadPage(nextCursor, filters)}
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

/** Render an RFC3339 timestamp in the browser's timezone. */
function dayjsLocal(v?: string): string {
  if (!v) return "-";
  return dayjs(v).format("YYYY-MM-DD HH:mm:ss");
}
