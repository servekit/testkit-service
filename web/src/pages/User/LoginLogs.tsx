import {
  PageContainer,
  ProTable,
  type ProColumns,
} from "@ant-design/pro-components";
import { Tag } from "antd";
import { getLoginLogs } from "@/services/testkit/testkitService";
import {
  DEVICE_TYPE_VALUE_ENUM,
  LOGIN_ACTION_VALUE_ENUM,
  PROVIDER_VALUE_ENUM,
} from "@/components/usertags";

/**
 * Admin login-audit log. getLoginLogs is cursor-based, so this page fetches a
 * bounded first page (no offset cursor paging — kept simple for P2). Optional
 * filters: target user_id, provider, success.
 */
export default function LoginLogsPage() {
  const columns: ProColumns<API.LoginLog>[] = [
    { title: "时间", dataIndex: "createdAt", valueType: "dateTime", width: 180 },
    { title: "用户 ID", dataIndex: "userId", width: 180, copyable: true },
    {
      title: "登录方式",
      dataIndex: "provider",
      valueType: "select",
      valueEnum: PROVIDER_VALUE_ENUM,
      width: 110,
    },
    {
      title: "动作",
      dataIndex: "action",
      valueType: "select",
      valueEnum: LOGIN_ACTION_VALUE_ENUM,
      width: 100,
    },
    {
      title: "结果",
      dataIndex: "success",
      valueType: "select",
      width: 90,
      valueEnum: {
        true: { text: "成功" },
        false: { text: "失败" },
      },
      render: (_, r) =>
        r.success ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
    },
    { title: "IP", dataIndex: "ip", width: 140 },
    {
      title: "设备",
      dataIndex: "deviceType",
      valueType: "select",
      valueEnum: DEVICE_TYPE_VALUE_ENUM,
      width: 90,
    },
    {
      title: "位置",
      search: false,
      render: (_, r) => [r.country, r.city].filter(Boolean).join(" ") || "-",
    },
    { title: "失败原因", dataIndex: "failReason", search: false },
  ];

  return (
    <PageContainer>
      <ProTable<API.LoginLog>
        columns={columns}
        rowKey="id"
        search={{ labelWidth: "auto" }}
        pagination={false}
        request={async (params) => {
          const resp = await getLoginLogs({
            userId: params.userId,
            provider: params.provider as API.GetLoginLogsParams["provider"],
            success:
              params.success === undefined
                ? undefined
                : params.success === "true",
            pageSize: 100,
          });
          return { data: resp.logs ?? [], success: true };
        }}
      />
    </PageContainer>
  );
}
