/**
 * Self-service "My Audit". Cursor-based list via listMyAuditLogs (owner
 * injected from ctx). Following the P2 convention for cursor-paginated RPCs
 * (see User/LoginLogs): a bounded first page with server pagination disabled.
 * Filters: action, target type, time range.
 */
import {
  PageContainer,
  ProTable,
  type ProColumns,
} from "@ant-design/pro-components";
import { listMyAuditLogs } from "@/services/testkit/testkitService";
import {
  AUDIT_ACTION_VALUE_ENUM,
  AUDIT_STATUS_VALUE_ENUM,
  AUDIT_TARGET_TYPE_VALUE_ENUM,
  AuditStatusTag,
  auditActionLabel,
} from "@/components/storagetags";

const TARGET_LABEL: Record<string, string> = {
  AUDIT_LOG_TARGET_TYPE_FILE: "文件",
  AUDIT_LOG_TARGET_TYPE_QUOTA: "配额",
  AUDIT_LOG_TARGET_TYPE_OWNER: "Owner",
};

export default function MyAuditPage() {
  const columns: ProColumns<API.v1AuditLogEntry>[] = [
    { title: "ID", dataIndex: "id", width: 180, copyable: true, search: false },
    {
      title: "操作",
      dataIndex: "action",
      valueType: "select",
      valueEnum: AUDIT_ACTION_VALUE_ENUM,
      render: (_, r) => auditActionLabel(r.action),
    },
    {
      title: "目标类型",
      dataIndex: "targetType",
      valueType: "select",
      valueEnum: AUDIT_TARGET_TYPE_VALUE_ENUM,
      render: (_, r) =>
        (r.targetType && TARGET_LABEL[r.targetType]) || "-",
    },
    { title: "目标 ID", dataIndex: "targetId", search: false, width: 180 },
    {
      title: "状态",
      dataIndex: "status",
      valueType: "select",
      valueEnum: AUDIT_STATUS_VALUE_ENUM,
      render: (_, r) => <AuditStatusTag status={r.status} />,
    },
    { title: "开始时间", dataIndex: "startTime", hideInTable: true },
    { title: "结束时间", dataIndex: "endTime", hideInTable: true },
    { title: "时间", dataIndex: "createdAt", search: false, width: 180 },
    { title: "request_id", dataIndex: "requestId", search: false, copyable: true },
    { title: "错误信息", dataIndex: "errorMessage", search: false },
  ];

  return (
    <PageContainer>
      <ProTable<API.v1AuditLogEntry>
        columns={columns}
        rowKey="id"
        search={{ labelWidth: "auto" }}
        pagination={false}
        request={async (params) => {
          const resp = await listMyAuditLogs({
            action: params.action as API.ListMyAuditLogsParams["action"],
            targetType:
              params.targetType as API.ListMyAuditLogsParams["targetType"],
            startTime: params.startTime,
            endTime: params.endTime,
            pageSize: 100,
          });
          return {
            data: resp.logs ?? [],
            total: resp.totalCount ?? 0,
            success: true,
          };
        }}
      />
    </PageContainer>
  );
}
