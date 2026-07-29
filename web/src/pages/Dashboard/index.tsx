/**
 * Internal landing dashboard (access: canInternal). Aggregates the global
 * GetDashboard RPC (concurrent fan-in over message/storage/user downstream)
 * into KPI tiles + per-vendor Pie charts. This is the page INTERNAL users land
 * on after login (P1 redirects INTERNAL → /dashboard).
 *
 * int64 counts/bytes arrive as STRING (fix-int64) — message counts are well
 * under 2^53 so Number() is safe for chart angles; bytes are formatted via the
 * shared formatBytes. successRate == -1 means "no data" (mirrors backend).
 * Calls the GENERATED service only — no hand-written fetch (design v2 Delta C).
 */
import { Pie } from "@ant-design/charts";
import { PageContainer, ProCard } from "@ant-design/pro-components";
import { Button, Col, Empty, Progress, Row, Spin, Statistic } from "antd";
import { useEffect, useState } from "react";
import {
  EMAIL_VENDOR_VALUE_ENUM,
  SMS_VENDOR_VALUE_ENUM,
} from "@/components/messagetags";
import { formatBytes } from "@/components/storagetags";
import { getDashboard } from "@/services/testkit/testkitService";

function vendorLabel(
  map: Record<string, { text: string }>,
  v: string | undefined,
): string {
  if (!v) return "未知";
  return map[v]?.text ?? v;
}

function toNumber(s: string | undefined): number {
  const n = Number(s ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function DashboardPage() {
  const [data, setData] = useState<API.v1DashboardResponse>();
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getDashboard());
    } catch {
      /* request interceptor surfaces errors + handles 401 redirect */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <div style={{ textAlign: "center", padding: 80 }}>
          <Spin />
        </div>
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <PageContainer>
        <div style={{ textAlign: "center", padding: 80 }}>
          <Empty description="暂无数据">
            <Button onClick={load}>重试</Button>
          </Empty>
        </div>
      </PageContainer>
    );
  }

  const email = data.emailStats ?? {};
  const sms = data.smsStats ?? {};
  const quota = data.quota ?? {};
  const users = data.users ?? {};

  // successRate in [0, 100]; -1 / undefined means "no data" → render "—".
  const emailRate = email.successRate != null && email.successRate >= 0
    ? email.successRate
    : undefined;
  const smsRate = sms.successRate != null && sms.successRate >= 0
    ? sms.successRate
    : undefined;

  const emailVendors = (email.vendors ?? [])
    .filter((x) => x.vendor && x.vendor !== "EMAIL_VENDOR_UNSPECIFIED")
    .map((x) => ({
      vendor: vendorLabel(EMAIL_VENDOR_VALUE_ENUM, x.vendor),
      count: toNumber(x.total),
    }));
  const smsVendors = (sms.vendors ?? [])
    .filter((x) => x.vendor && x.vendor !== "SMS_VENDOR_UNSPECIFIED")
    .map((x) => ({
      vendor: vendorLabel(SMS_VENDOR_VALUE_ENUM, x.vendor),
      count: toNumber(x.total),
    }));

  const usedBytes = toNumber(quota.usedBytes);
  const totalBytes = toNumber(quota.totalBytes);
  const quotaPct =
    totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

  return (
    <PageContainer>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic title="邮件总数" value={email.total ?? "0"} />
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic
              title="邮件成功率"
              value={emailRate ?? "—"}
              suffix={emailRate != null ? "%" : undefined}
            />
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic title="短信总数" value={sms.total ?? "0"} />
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic
              title="短信成功率"
              value={smsRate ?? "—"}
              suffix={smsRate != null ? "%" : undefined}
            />
          </ProCard>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic title="用户总数" value={users.total ?? "0"} />
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic title="文件数" value={quota.fileCount ?? 0} />
          </ProCard>
        </Col>
        <Col xs={24} md={12}>
          <ProCard title="存储配额" headerBordered>
            <Progress
              percent={quotaPct}
              status={quotaPct >= 90 ? "exception" : "normal"}
            />
            <Statistic
              title="已用 / 总量"
              value={formatBytes(quota.usedBytes)}
              suffix={`/ ${formatBytes(quota.totalBytes)}`}
            />
          </ProCard>
        </Col>

        <Col xs={24} md={12}>
          <ProCard title="邮件供应商分布" headerBordered>
            {emailVendors.length ? (
              <div style={{ height: 260 }}>
                <Pie
                  data={emailVendors}
                  angleField="count"
                  colorField="vendor"
                  radius={0.8}
                />
              </div>
            ) : (
              <Empty description="暂无数据" />
            )}
          </ProCard>
        </Col>
        <Col xs={24} md={12}>
          <ProCard title="短信供应商分布" headerBordered>
            {smsVendors.length ? (
              <div style={{ height: 260 }}>
                <Pie
                  data={smsVendors}
                  angleField="count"
                  colorField="vendor"
                  radius={0.8}
                />
              </div>
            ) : (
              <Empty description="暂无数据" />
            )}
          </ProCard>
        </Col>
      </Row>
    </PageContainer>
  );
}
