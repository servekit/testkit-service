import { PageContainer, ProTable, type ProColumns } from "@ant-design/pro-components";
import { spinReload } from "@/components/TableOptions";
import { Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { getLoginLogs, userListApps } from "@/services/testkit/testkitService";
import {
  DEVICE_TYPE_VALUE_ENUM,
  LOGIN_ACTION_VALUE_ENUM,
  LOGIN_METHOD_VALUE_ENUM,
} from "@/components/usertags";
import { useCursorTable } from "@/components/CursorPager";

/** Select options derived from a shared value-enum table. */
function toEnumOptions(valueEnum: Record<string, { text: string }>) {
  return Object.entries(valueEnum).map(([value, { text }]) => ({ value, label: text }));
}

const METHOD_OPTIONS = toEnumOptions(LOGIN_METHOD_VALUE_ENUM);
const ACTION_OPTIONS = toEnumOptions(LOGIN_ACTION_VALUE_ENUM);

/**
 * Auth audit log (login/register attempts — the backend table also records
 * social/binding events, hence the page name 认证记录). The backend is
 * cursor-paginated (an audit table only grows, so cursor paging never skips
 * or repeats rows the way offset paging does under a steady write stream);
 * useCursorTable surfaces it as progressive prev/next paging.
 */
export default function LoginLogsPage() {
  // 租户选项（平台运营视角可跨租户审计；普通租户视角服务端会忽略并锁定自己）
  const [apps, setApps] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    void userListApps().then((resp) => {
      setApps(
        (resp.apps ?? []).map((a) => ({
          value: a.appKey ?? "",
          label: `${a.name}（${a.appKey}）`,
        })),
      );
    });
  }, []);

  const logs = useCursorTable(async ({ cursor, pageSize, username, userId, method, action, success, appKey }) => {
    const resp = await getLoginLogs({
      username: (username as string) || undefined,
      userId: (userId as string) || undefined,
      method: method as API.GetLoginLogsParams["method"],
      action: action as API.GetLoginLogsParams["action"],
      success:
        success === undefined || success === ""
          ? undefined
          : success === "true" || success === true,
      appKey: (appKey as string) || undefined,
      pageSize,
      cursor: cursor || undefined,
    });
    return { items: resp.logs, nextCursor: resp.nextCursor };
  });

  const columns: ProColumns<API.LoginLog>[] = [
    {
      title: "租户",
      dataIndex: "appKey",
      valueType: "select",
      fieldProps: { options: apps, allowClear: true },
      width: 150,
      render: (_, r) => (r.appKey ? <code>{r.appKey}</code> : "-"),
    },
    {
      title: "用户名",
      dataIndex: "username",
      width: 140,
      render: (_, r) => r.username || "-",
    },
    {
      title: "用户 ID",
      dataIndex: "userId",
      width: 180,
      render: (_, r) => String(r.userId || "-"),
    },
    {
      title: "认证对象",
      dataIndex: "target",
      search: false,
      width: 170,
      // The credential subject (username/email/phone/oauth-uid) — the kind
      // reads from the 登录方式/动作 columns next to it.
      render: (_, r) => r.target || "-",
    },
    {
      title: "登录方式",
      dataIndex: "method",
      valueType: "select",
      fieldProps: { options: METHOD_OPTIONS },
      width: 110,
      render: (_, r) =>
        LOGIN_METHOD_VALUE_ENUM[r.method as keyof typeof LOGIN_METHOD_VALUE_ENUM]?.text ?? "-",
    },
    {
      title: "动作",
      dataIndex: "action",
      valueType: "select",
      fieldProps: { options: ACTION_OPTIONS },
      width: 100,
      render: (_, r) =>
        LOGIN_ACTION_VALUE_ENUM[r.action as keyof typeof LOGIN_ACTION_VALUE_ENUM]?.text ?? "-",
    },
    {
      title: "结果",
      dataIndex: "success",
      valueType: "select",
      fieldProps: {
        options: [
          { value: "true", label: "成功" },
          { value: "false", label: "失败" },
        ],
      },
      width: 90,
      render: (_, r) =>
        r.success ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
    },
    { title: "IP", dataIndex: "ip", search: false, width: 140 },
    {
      title: "设备",
      dataIndex: "deviceType",
      search: false,
      width: 90,
      render: (_, r) =>
        DEVICE_TYPE_VALUE_ENUM[
          r.deviceType as keyof typeof DEVICE_TYPE_VALUE_ENUM
        ]?.text ?? "-",
    },
    {
      title: "位置",
      search: false,
      render: (_, r) => [r.country, r.city].filter(Boolean).join(" ") || "-",
    },
    {
      title: "失败原因",
      dataIndex: "failReason",
      search: false,
      render: (_, r) => {
        // Successful rows carry LOGIN_FAIL_REASON_UNSPECIFIED — render as "-"
        // like the pre-enum empty value; unmapped future values pass raw.
        if (!r.failReason || r.failReason === "LOGIN_FAIL_REASON_UNSPECIFIED") return "-";
        const labels: Record<string, string> = {
          LOGIN_FAIL_REASON_WRONG_PASSWORD: "密码错误",
          LOGIN_FAIL_REASON_WRONG_CODE: "验证码错误",
          LOGIN_FAIL_REASON_VERIFY_FAILED: "校验未通过",
        };
        return <Typography.Text type="secondary">{labels[r.failReason] ?? r.failReason}</Typography.Text>;
      },
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      search: false,
      width: 180,
      render: (_, r) => fmt(r.createdAt),
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.LoginLog>
        actionRef={logs.actionRef}
        columns={columns}
        rowKey="id"
        search={{ labelWidth: "auto" }}
        pagination={false}
        options={spinReload}
        request={logs.request}
        footer={() => logs.pager}
      />
    </PageContainer>
  );
}

/** Render an RFC3339 timestamp in the browser's timezone. */
function fmt(v?: string): string {
  return v ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : "-";
}
