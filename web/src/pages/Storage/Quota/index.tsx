/**
 * Self-service "My Quota". Single entity from getMyQuota (owner injected from
 * ctx by the BFF). Shows total/used/available/file-count stat cards plus a
 * usage progress bar. Byte fields arrive as string (int64) — formatBytes parses.
 */
import {
  PageContainer,
  ProCard,
  StatisticCard,
} from "@ant-design/pro-components";
import { Progress, Typography } from "antd";
import { useRequest } from "@umijs/max";
import { getMyQuota } from "@/services/testkit/testkitService";
import { formatBytes } from "@/components/storagetags";

const { Paragraph } = Typography;

export default function MyQuotaPage() {
  // useRequest doesn't infer getMyQuota's return type through the generated
  // overload, so narrow `data` to the quota shape explicitly.
  const { data: raw, loading } = useRequest(getMyQuota);
  const data = raw as API.v1QuotaInfo | undefined;

  const total = Number(data?.totalBytes ?? 0);
  const used = Number(data?.usedBytes ?? 0);
  const available = Number(data?.availableBytes ?? 0);
  const percent =
    total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <PageContainer>
      <ProCard ghost gutter={16} wrap>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
          <StatisticCard
            statistic={{
              title: "总配额",
              value: formatBytes(data?.totalBytes),
            }}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
          <StatisticCard
            statistic={{
              title: "已用",
              value: formatBytes(data?.usedBytes),
            }}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
          <StatisticCard
            statistic={{
              title: "可用",
              value: formatBytes(data?.availableBytes),
            }}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
          <StatisticCard
            statistic={{
              title: "文件数",
              value: data?.fileCount ?? 0,
              loading,
            }}
          />
        </ProCard>
      </ProCard>

      <ProCard title="使用情况" headerBordered style={{ marginTop: 16 }}>
        <Paragraph>
          已使用 <strong>{formatBytes(used)}</strong> /{" "}
          {formatBytes(total)}（{percent}%），剩余 {formatBytes(available)}
        </Paragraph>
        <Progress percent={percent} status={percent >= 90 ? "exception" : "normal"} />
      </ProCard>
    </PageContainer>
  );
}
