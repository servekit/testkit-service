import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { useCursorTable } from "@/components/CursorPager";
import { spinReload } from "@/components/TableOptions";
import { listPagination } from "@/utils/pagination";
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Modal,
  Segmented,
  Space,
  Statistic,
} from "antd";
import { useEffect, useRef, useState } from "react";
import {
  getEmail,
  getEmailStats,
  listEmailsByCursor,
  listEmailSenders,
  listEmails,
} from "@/services/testkit/testkitService";
import {
  EMAIL_SCENE_VALUE_ENUM,
  EMAIL_VENDOR_VALUE_ENUM,
  MESSAGE_STATUS_VALUE_ENUM,
  MessageStatusTag,
  formatTimestamp,
} from "@/components/messagetags";

/**
 * Email records ops console: ProTable over the offset-paginated listEmails
 * RPC (the unified list style — filter form + toolbar refresh + numbered
 * pagination). All data flows through GENERATED services — no hand-written
 * fetch. `sender_id` is NOT a table filter (plan decision 2: not forwarded);
 * known senders are surfaced in the stats modal for audit context.
 */
export default function EmailRecordsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);

  const [senders, setSenders] = useState<string[]>([]);
  const [detail, setDetail] = useState<API.v1EmailRecord | null>(null);
  const [stats, setStats] = useState<API.v1EmailStatsResponse | null>(null);

  // Pagination mode: the backend listEmails offers BOTH styles; the console
  // shows them side by side (testkit exists to exercise every contract).
  // Cursor mode rides the console-wide useCursorTable convention (filters
  // keep flowing through the ProTable search form).
  const [mode, setMode] = useState<"offset" | "cursor">("offset");
  const cursorTable = useCursorTable<API.v1EmailRecord>(async (params) => {
    const r = await listEmailsByCursor({
      pageToken: (params.cursor as string) || undefined,
      pageSize: params.pageSize,
      vendor: params.vendor as API.ListEmailsByCursorParams["vendor"],
      scene: params.scene as API.ListEmailsByCursorParams["scene"],
      status: params.status as API.ListEmailsByCursorParams["status"],
      target: params.target as string | undefined,
      sortField: "SORT_FIELD_CREATED_AT",
      sortDirection: "SORT_DIRECTION_DESC",
    });
    return { items: r.records ?? [], nextCursor: r.nextPageToken };
  });

  useEffect(() => {
    listEmailSenders()
      .then((r) => setSenders(r.senderIds ?? []))
      .catch(() => {
        /* 401 handled by interceptor; ignore list-load failures */
      });
  }, []);

  const columns: ProColumns<API.v1EmailRecord>[] = [
    { title: "ID", dataIndex: "id", width: 180, search: false },
    {
      title: "供应商",
      dataIndex: "vendor",
      width: 100,
      valueType: "select",
      valueEnum: EMAIL_VENDOR_VALUE_ENUM,
    },
    {
      title: "场景",
      dataIndex: "scene",
      width: 110,
      valueType: "select",
      valueEnum: EMAIL_SCENE_VALUE_ENUM,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      valueType: "select",
      valueEnum: MESSAGE_STATUS_VALUE_ENUM,
      render: (_, r) => <MessageStatusTag status={r.status} />,
    },
    {
      title: "收件人",
      dataIndex: "target",
      width: 220,
      render: (_, r) => r.target?.email || "-",
    },
    { title: "主题", dataIndex: "subject", ellipsis: true, search: false },
    {
      title: "发送方",
      dataIndex: "senderId",
      width: 150,
      search: false,
    },
    {
      title: "发送时间",
      dataIndex: "sentAt",
      valueType: "dateTime",
      width: 170,
      search: false,
      render: (_, r) => formatTimestamp(r.sentAt),
    },
    {
      title: "操作",
      width: 80,
      valueType: "option",
      render: (_, r) => [
        <a
          key="detail"
          onClick={async () => {
            try {
              const rec = await getEmail({ id: r.id ?? "" });
              setDetail(rec);
            } catch {
              message.error("加载详情失败");
            }
          }}
        >
          详情
        </a>,
      ],
    },
  ];

  return (
    <PageContainer>
      <Card
        bordered={false}
        extra={
        <Space>
          <Segmented
            value={mode}
            onChange={(v) => {
              setMode(v as "offset" | "cursor");
            }}
            options={[
              { label: "传统分页", value: "offset" },
              { label: "游标分页", value: "cursor" },
            ]}
          />
          <Button
            onClick={async () => {
              try {
                const r = await getEmailStats({});
                setStats(r);
              } catch {
                message.error("加载统计失败");
              }
            }}
          >
            统计
          </Button>
        </Space>
        }
      >
        <ProTable<API.v1EmailRecord>
          actionRef={mode === "offset" ? actionRef : cursorTable.actionRef}
          rowKey="id"
          columns={columns}
          search={{ labelWidth: "auto" }}
          pagination={mode === "offset" ? listPagination : false}
          options={spinReload}
          request={
            mode === "offset"
              ? async (params) => {
                  try {
                    const resp = await listEmails({
                      vendor: params.vendor as API.ListEmailsParams["vendor"],
                      scene: params.scene as API.ListEmailsParams["scene"],
                      status: params.status as API.ListEmailsParams["status"],
                      target: params.target as string | undefined,
                      page: params.current ?? 1,
                      pageSize: params.pageSize ?? 20,
                      sortField: "SORT_FIELD_CREATED_AT",
                      sortDirection: "SORT_DIRECTION_DESC",
                    });
                    return {
                      data: resp.records ?? [],
                      success: true,
                      total: resp.total ?? 0,
                    };
                  } catch {
                    return { data: [], success: false };
                  }
                }
              : cursorTable.request
          }
        />
        {mode === "cursor" && cursorTable.pager}

        <Drawer
          open={!!detail}
          onClose={() => setDetail(null)}
          width={640}
          title="邮件详情"
        >
          {detail && (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <MessageStatusTag status={detail.status} />
              </Descriptions.Item>
              <Descriptions.Item label="供应商">
                {EMAIL_VENDOR_VALUE_ENUM[detail.vendor as keyof typeof EMAIL_VENDOR_VALUE_ENUM]?.text ??
                  detail.vendor ??
                  "-"}
              </Descriptions.Item>
              <Descriptions.Item label="场景">
                {EMAIL_SCENE_VALUE_ENUM[detail.scene as keyof typeof EMAIL_SCENE_VALUE_ENUM]?.text ??
                  detail.scene ??
                  "-"}
              </Descriptions.Item>
              <Descriptions.Item label="收件人">
                {detail.target?.email || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="抄送">
                {(detail.cc ?? []).map((a) => a.email).join(", ") || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="主题">
                {detail.subject || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="纯文本正文">
                {detail.content || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="HTML 正文">
                {detail.htmlBody || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="模板">
                {detail.templateId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="发送方">
                {detail.senderId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="错误信息">
                {detail.errorMessage || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="尝试次数">
                {detail.attempts ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="发送时间">
                {formatTimestamp(detail.sentAt)}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatTimestamp(detail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="附件">
                {(detail.attachments ?? [])
                  .map((a) => a.filename)
                  .join(", ") || "-"}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Drawer>

        <Modal
          open={!!stats}
          onCancel={() => setStats(null)}
          footer={null}
          title="邮件统计"
          width={720}
        >
          {stats && (
            <div>
              <Space size="large">
                <Statistic title="总数" value={stats.total ?? "0"} />
                <Statistic
                  title="成功"
                  value={stats.sent ?? "0"}
                  valueStyle={{ color: "green" }}
                />
                <Statistic
                  title="失败"
                  value={stats.failed ?? "0"}
                  valueStyle={{ color: "red" }}
                />
                <Statistic
                  title="成功率"
                  value={
                    Number(stats.successRate) < 0
                      ? "-"
                      : stats.successRate
                  }
                  suffix={Number(stats.successRate) < 0 ? "" : "%"}
                />
              </Space>
              <ProTable<API.v1EmailVendorStats>
                rowKey="vendor"
                size="small"
                search={false}
                pagination={false}
                dataSource={stats.vendors ?? []}
                style={{ marginTop: 16 }}
                columns={[
                  {
                    title: "供应商",
                    dataIndex: "vendor",
                    render: (_, r) =>
                      EMAIL_VENDOR_VALUE_ENUM[
                        r.vendor as keyof typeof EMAIL_VENDOR_VALUE_ENUM
                      ]?.text ?? r.vendor ??
                      "-",
                  },
                  { title: "总数", dataIndex: "total" },
                  { title: "成功", dataIndex: "sent" },
                  { title: "失败", dataIndex: "failed" },
                ]}
              />
              <div style={{ marginTop: 16, color: "rgba(0,0,0,0.65)" }}>
                已知发送方：{senders.join(", ") || "-"}
              </div>
            </div>
          )}
        </Modal>
      </Card>
    </PageContainer>
  );
}
