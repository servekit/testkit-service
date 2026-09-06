/**
 * Admin storage stats. adminGetStats returns aggregate totals plus per-owner /
 * per-provider / per-bucket breakdowns. Optional ownerType/ownerId filter;
 * empty = all owners. Byte fields arrive as string (int64) — formatBytes parses.
 * access: canInternal at the route level.
 */
import {
  PageContainer,
  ProCard,
  ProTable,
  StatisticCard,
  type ProColumns,
} from "@ant-design/pro-components";
import { App, Button, Form, Input, Select } from "antd";
import { useState } from "react";
import { adminGetStats } from "@/services/testkit/testkitService";
import {
  OWNER_TYPE_VALUE_ENUM,
  formatBytes,
} from "@/components/storagetags";

export default function AdminStatsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [data, setData] = useState<API.v1AdminGetStatsResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{
    ownerType?: API.v1OwnerType;
    ownerId?: string;
  }>({});

  const fetchStats = async (params: {
    ownerType?: API.v1OwnerType;
    ownerId?: string;
  }) => {
    setLoading(true);
    try {
      const resp = await adminGetStats({
        ownerType: params.ownerType,
        ownerId: params.ownerId,
      });
      setData(resp);
      setFilter(params);
    } catch {
      message.error("加载统计失败");
    } finally {
      setLoading(false);
    }
  };

  const ownerColumns: ProColumns<API.v1OwnerStats>[] = [
    {
      title: "Owner 类型",
      dataIndex: "ownerType",
      render: (_, r) =>
        OWNER_TYPE_VALUE_ENUM[r.ownerType as keyof typeof OWNER_TYPE_VALUE_ENUM]
          ?.text ?? r.ownerType,
    },
    { title: "文件数", dataIndex: "fileCount" },
    {
      title: "总字节",
      dataIndex: "totalBytes",
      render: (_, r) => formatBytes(r.totalBytes),
    },
  ];

  const providerColumns: ProColumns<API.v1ProviderStats>[] = [
    { title: "Provider", dataIndex: "provider" },
    { title: "对象数", dataIndex: "objectCount" },
    {
      title: "总字节",
      dataIndex: "totalBytes",
      render: (_, r) => formatBytes(r.totalBytes),
    },
  ];

  const bucketColumns: ProColumns<API.v1BucketStats>[] = [
    { title: "Bucket", dataIndex: "bucket" },
    { title: "对象数", dataIndex: "objectCount" },
    { title: "文件数", dataIndex: "fileCount" },
    {
      title: "总字节",
      dataIndex: "totalBytes",
      render: (_, r) => formatBytes(r.totalBytes),
    },
  ];

  return (
    <PageContainer>
      <ProCard title="过滤" headerBordered style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={(vals) =>
            fetchStats({
              ownerType: vals.ownerType as API.v1OwnerType | undefined,
              ownerId: vals.ownerId || undefined,
            })
          }
        >
          <Form.Item name="ownerType" label="Owner 类型">
            <Select
              allowClear
              style={{ width: 140 }}
              options={Object.entries(OWNER_TYPE_VALUE_ENUM)
                .filter(([k]) => k !== "OWNER_TYPE_UNSPECIFIED")
                .map(([k, v]) => ({ value: k, label: v.text }))}
            />
          </Form.Item>
          <Form.Item name="ownerId" label="Owner ID">
            <Input allowClear placeholder="留空 = 全部" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              查询
            </Button>
          </Form.Item>
          <Form.Item>
            {/* Re-run the CURRENT filter (not the form draft) — the shared
                stats feed serves all three tables below. */}
            <Button loading={loading} onClick={() => fetchStats(filter)}>
              刷新
            </Button>
          </Form.Item>
        </Form>
      </ProCard>

      <ProCard ghost gutter={16} wrap>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
          <StatisticCard
            statistic={{
              title: "对象数（去重）",
              value: Number(data?.totalObjects ?? 0),
              loading,
            }}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
          <StatisticCard
            statistic={{
              title: "文件引用",
              value: Number(data?.totalFiles ?? 0),
              loading,
            }}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
          <StatisticCard
            statistic={{
              title: "物理占用",
              value: formatBytes(data?.physicalBytes),
              loading,
            }}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
          <StatisticCard
            statistic={{
              title: "逻辑占用",
              value: formatBytes(data?.logicalBytes),
              loading,
            }}
          />
        </ProCard>
      </ProCard>

      <ProTable<API.v1OwnerStats>
        headerTitle={
          filter.ownerId ? `按 Owner (${filter.ownerId})` : "按 Owner"
        }
        columns={ownerColumns}
        rowKey={(r) => `${r.ownerType}/${r.fileCount}`}
        search={false}
        pagination={false}
        options={false}
        dataSource={data?.ownerStats ?? []}
        loading={loading}
        style={{ marginTop: 16 }}
      />
      <ProTable<API.v1ProviderStats>
        headerTitle="按 Provider"
        columns={providerColumns}
        rowKey="provider"
        search={false}
        pagination={false}
        options={false}
        dataSource={data?.providerStats ?? []}
        loading={loading}
        style={{ marginTop: 16 }}
      />
      <ProTable<API.v1BucketStats>
        headerTitle="按 Bucket"
        columns={bucketColumns}
        rowKey="bucket"
        search={false}
        pagination={false}
        options={false}
        dataSource={data?.bucketStats ?? []}
        loading={loading}
        style={{ marginTop: 16 }}
      />
    </PageContainer>
  );
}
