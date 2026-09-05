import {
  ProFormDigit,
  ProFormText,
} from "@ant-design/pro-components";
import { App, Alert, Button, Card, Form, Table, Typography } from "antd";
import { useState } from "react";
import { getAppStats } from "@/services/testkit/testkitService";

const { Paragraph } = Typography;

/**
 * Telemetry app stats viewer: per-day event rollups plus drop/签名失败计数.
 */
export default function TelemetryStatsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<API.v1GetAppStatsResponse | null>(null);
  const [error, setError] = useState("");
  const [form] = Form.useForm();

  const load = async (vals: { slug?: string; days?: number }) => {
    if (!vals.slug) {
      message.warning("请输入 slug");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await getAppStats({ slug: vals.slug, days: vals.days ?? 14 }));
    } catch (err) {
      const e = err as { data?: { message?: string } };
      setError(e?.data?.message ?? "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="应用统计">
      <Form form={form} layout="inline" onFinish={load} initialValues={{ days: 14 }}>
        <ProFormText
          name="slug"
          placeholder="slug（如 smoke-app）"
          rules={[{ required: true, message: "请输入 slug" }]}
        />
        <ProFormDigit name="days" label="天数" min={1} max={90} />
        <Button type="primary" htmlType="submit" loading={loading}>
          查询
        </Button>
      </Form>

      {error && <Alert type="error" message={error} style={{ marginTop: 16 }} />}
      {data && (
        <>
          <Table<API.v1DailyStat>
            style={{ marginTop: 16 }}
            rowKey="day"
            size="small"
            pagination={false}
            dataSource={data.days ?? []}
            columns={[
              { title: "日期", dataIndex: "day" },
              { title: "事件数", dataIndex: "events" },
              { title: "活跃设备", dataIndex: "devices" },
              { title: "版本数", dataIndex: "versions" },
            ]}
          />
          <Paragraph style={{ marginTop: 16 }}>
            <strong>丢弃计数：</strong>
            <pre style={{ margin: 0 }}>
              {JSON.stringify(data.drops ?? {}, null, 2)}
            </pre>
            <strong>签名失败：</strong>
            <pre style={{ margin: 0 }}>
              {JSON.stringify(data.sigFails ?? {}, null, 2)}
            </pre>
          </Paragraph>
        </>
      )}
    </Card>
  );
}
