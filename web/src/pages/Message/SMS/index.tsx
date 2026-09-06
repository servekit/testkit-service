import {
  PageContainer,
  ProTable,
  type ProColumns,
} from "@ant-design/pro-components";
import { App, Card, Descriptions, Drawer, Modal, Space, Statistic } from "antd";
import { useEffect, useState } from "react";
import {
  getSms,
  getSmsStats,
  listSms,
  listSmsRegions,
  listSmsSenders,
} from "@/services/testkit/testkitService";
import {
  MESSAGE_STATUS_VALUE_ENUM,
  SMS_SCENE_VALUE_ENUM,
  SMS_VENDOR_VALUE_ENUM,
  MessageStatusTag,
  formatTimestamp,
} from "@/components/messagetags";

/**
 * SMS records ops console. Offset paging via listSms (ProTable native). region
 * is a genuine forwarded filter (sourced from listSmsRegions as a select); phone
 * is a text filter. Stats via getSmsStats; senders/regions are surfaced in the
 * modal for audit context (sender_id is NOT a forwarded filter — plan decision
 * 2). All data flows through GENERATED services — no hand-written fetch.
 */
export default function SMSRecordsPage() {
  const { message } = App.useApp();
  const [regions, setRegions] = useState<string[]>([]);
  const [senders, setSenders] = useState<string[]>([]);
  const [detail, setDetail] = useState<API.v1SMSRecord | null>(null);
  const [stats, setStats] = useState<API.v1SMSStatsResponse | null>(null);

  useEffect(() => {
    listSmsRegions()
      .then((r) => setRegions(r.regionCodes ?? []))
      .catch(() => {});
    listSmsSenders()
      .then((r) => setSenders(r.senderIds ?? []))
      .catch(() => {});
  }, []);

  const columns: ProColumns<API.v1SMSRecord>[] = [
    { title: "ID", dataIndex: "id", width: 180, copyable: true, search: false },
    {
      title: "供应商",
      dataIndex: "vendor",
      width: 110,
      valueType: "select",
      valueEnum: SMS_VENDOR_VALUE_ENUM,
    },
    {
      title: "场景",
      dataIndex: "scene",
      width: 110,
      valueType: "select",
      valueEnum: SMS_SCENE_VALUE_ENUM,
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
      title: "区域",
      dataIndex: "regionCode",
      width: 80,
      valueType: "select",
      fieldProps: {
        options: regions.map((r) => ({ label: r, value: r })),
      },
    },
    { title: "手机号", dataIndex: "phone", width: 150, copyable: true },
    {
      title: "发送方",
      dataIndex: "senderId",
      width: 150,
      copyable: true,
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
              const rec = await getSms({ id: r.id ?? "" });
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
          <a
            onClick={async () => {
              try {
                const r = await getSmsStats({});
                setStats(r);
              } catch {
                message.error("加载统计失败");
              }
            }}
          >
            统计
          </a>
        }
      >
        <ProTable<API.v1SMSRecord>
          rowKey="id"
          columns={columns}
          search={{ labelWidth: "auto" }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          request={async (params) => {
            try {
              const resp = await listSms({
                vendor: params.vendor as API.ListSMSParams["vendor"],
                scene: params.scene as API.ListSMSParams["scene"],
                status: params.status as API.ListSMSParams["status"],
                regionCode: params.regionCode as string | undefined,
                phone: params.phone as string | undefined,
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
          }}
        />

        <Drawer
          open={!!detail}
          onClose={() => setDetail(null)}
          width={560}
          title="短信详情"
        >
          {detail && (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <MessageStatusTag status={detail.status} />
              </Descriptions.Item>
              <Descriptions.Item label="供应商">
                {SMS_VENDOR_VALUE_ENUM[detail.vendor as keyof typeof SMS_VENDOR_VALUE_ENUM]?.text ??
                  detail.vendor ??
                  "-"}
              </Descriptions.Item>
              <Descriptions.Item label="场景">
                {SMS_SCENE_VALUE_ENUM[detail.scene as keyof typeof SMS_SCENE_VALUE_ENUM]?.text ??
                  detail.scene ??
                  "-"}
              </Descriptions.Item>
              <Descriptions.Item label="区域 / 手机">
                {detail.regionCode} {detail.phone}
              </Descriptions.Item>
              <Descriptions.Item label="正文">
                {detail.content || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="模板">
                {detail.templateId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="发送方">
                {detail.senderId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="错误">
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
            </Descriptions>
          )}
        </Drawer>

        <Modal
          open={!!stats}
          onCancel={() => setStats(null)}
          footer={null}
          title="短信统计"
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
                    Number(stats.successRate) < 0 ? "-" : stats.successRate
                  }
                  suffix={Number(stats.successRate) < 0 ? "" : "%"}
                />
              </Space>
              <ProTable<API.v1SmsVendorStats>
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
                      SMS_VENDOR_VALUE_ENUM[
                        r.vendor as keyof typeof SMS_VENDOR_VALUE_ENUM
                      ]?.text ?? r.vendor ??
                      "-",
                  },
                  { title: "总数", dataIndex: "total" },
                  { title: "成功", dataIndex: "sent" },
                  { title: "失败", dataIndex: "failed" },
                ]}
              />
              <div style={{ marginTop: 16, color: "rgba(0,0,0,0.65)" }}>
                <div>已知区域：{regions.join(", ") || "-"}</div>
                <div>已知发送方：{senders.join(", ") || "-"}</div>
              </div>
            </div>
          )}
        </Modal>
      </Card>
    </PageContainer>
  );
}
