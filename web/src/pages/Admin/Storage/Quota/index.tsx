/**
 * Admin quota: read (adminGetQuota) and set (adminSetQuota) a target owner's
 * quota. ownerType/ownerId are the OPERATION TARGET (kept in the request, not
 * injected from ctx) per the P3 curation rules. access: canPlatform at route.
 *
 * Byte fields arrive as string (int64). The set form sends totalBytes as a
 * string to match the generated request shape.
 */
import {
  PageContainer,
  ProCard,
  StatisticCard,
} from "@ant-design/pro-components";
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
} from "antd";
import { useState } from "react";
import { adminGetQuota, adminSetQuota } from "@/services/testkit/testkitService";
import {
  OWNER_TYPE_VALUE_ENUM,
  formatBytes,
} from "@/components/storagetags";

export default function AdminQuotaPage() {
  const { message } = App.useApp();
  const [queryForm] = Form.useForm();
  const [setForm] = Form.useForm();
  const [target, setTarget] = useState<{
    ownerType?: API.v1OwnerType;
    ownerId?: string;
  }>({});
  const [quota, setQuota] = useState<API.v1QuotaInfo | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchQuota = async (vals: {
    ownerType?: API.v1OwnerType;
    ownerId?: string;
  }) => {
    if (!vals.ownerType || vals.ownerType === "OWNER_TYPE_UNSPECIFIED" || !vals.ownerId) {
      message.warning("请选择 Owner 类型并填写 Owner ID");
      return;
    }
    setLoading(true);
    try {
      const resp = await adminGetQuota({
        ownerType: vals.ownerType,
        ownerId: vals.ownerId,
      });
      setQuota(resp);
      setTarget({ ownerType: vals.ownerType, ownerId: vals.ownerId });
      setForm.setFieldsValue({
        totalBytes: resp.totalBytes ? Number(resp.totalBytes) : undefined,
      });
    } catch {
      message.error("查询配额失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSet = async (vals: { totalBytes?: number }) => {
    if (!target.ownerType || !target.ownerId || !vals.totalBytes) {
      message.warning("请先查询 Owner 并填写新的总配额");
      return;
    }
    setSaving(true);
    try {
      const resp = await adminSetQuota({
        ownerType: target.ownerType,
        ownerId: target.ownerId,
        totalBytes: String(vals.totalBytes),
      });
      setQuota(resp);
      message.success("已更新");
    } catch {
      message.error("更新配额失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <ProCard title="查询 Owner 配额" headerBordered style={{ marginBottom: 16 }}>
        <Form
          form={queryForm}
          layout="inline"
          onFinish={fetchQuota}
        >
          <Form.Item name="ownerType" label="Owner 类型" rules={[{ required: true }]}>
            <Select
              style={{ width: 140 }}
              options={Object.entries(OWNER_TYPE_VALUE_ENUM)
                .filter(([k]) => k !== "OWNER_TYPE_UNSPECIFIED")
                .map(([k, v]) => ({ value: k, label: v.text }))}
            />
          </Form.Item>
          <Form.Item name="ownerId" label="Owner ID" rules={[{ required: true }]}>
            <Input style={{ width: 220 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              查询
            </Button>
          </Form.Item>
        </Form>
      </ProCard>

      {quota && (
        <>
          <ProCard
            title={`当前配额 — ${target.ownerType ?? ""} / ${target.ownerId ?? ""}`}
            headerBordered
            style={{ marginBottom: 16 }}
          >
            <ProCard ghost gutter={16} wrap>
              <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <StatisticCard
                  statistic={{
                    title: "总配额",
                    value: formatBytes(quota.totalBytes),
                  }}
                />
              </ProCard>
              <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <StatisticCard
                  statistic={{
                    title: "已用",
                    value: formatBytes(quota.usedBytes),
                  }}
                />
              </ProCard>
              <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <StatisticCard
                  statistic={{
                    title: "可用",
                    value: formatBytes(quota.availableBytes),
                  }}
                />
              </ProCard>
              <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <StatisticCard
                  statistic={{ title: "文件数", value: quota.fileCount ?? 0 }}
                />
              </ProCard>
            </ProCard>
          </ProCard>

          <ProCard title="设置总配额（字节）" headerBordered>
            <Form form={setForm} layout="inline" onFinish={handleSet}>
              <Form.Item
                name="totalBytes"
                label="总配额 (B)"
                rules={[{ required: true, message: "请输入总配额" }]}
              >
                <InputNumber min={1} style={{ width: 240 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={saving}>
                  保存
                </Button>
              </Form.Item>
            </Form>
          </ProCard>
        </>
      )}
    </PageContainer>
  );
}
