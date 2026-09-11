/**
 * Telemetry · 上报令牌自服务（tenant platform phase ④）。
 *
 * ingest token 是终端客户端上报面（公网暴露）的唯一凭据：落库即哈希，
 * 明文只在 创建 / 轮换 响应里出现一次——弹窗展示 + 复制，关闭即散。
 *
 * - 租户视图（TENANT_ADMIN 固定租户 / PLATFORM 下钻）：令牌按注入租户
 *   归属（③期 token 落库带 tenant_key，随租户的应用行走）。应用行不存
 *   在时「生成」会以租户键为 app_key 建立配置行（与可信上报路径的懒建
 *   同构）并铸出首枚令牌；已存在则「轮换」追加一枚（旧令牌保持有效，
 *   零停机），行内可吊销旧令牌收尾。
 * - 跨租户视图（PLATFORM 未选租户）：无单一租户上下文，提示先选租户。
 */
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  Alert,
  App,
  Button,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from "antd";
import { useRef, useState } from "react";
import {
  createTenantConfig,
  getTenantConfig,
  listTenantConfigs,
  revokeToken,
  rotateToken,
} from "@/services/testkit/testkitService";
import { SecretText } from "@/components/SecretText";
import { useTenantView } from "@/components/tenantScope";

function bizMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
}

/** token 明文只显一次的弹窗（租户令牌自管理的核心约定）。 */
function showTokenOnce(title: string, token: string) {
  Modal.info({
    title,
    width: 640,
    content: (
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Alert
          type="warning"
          showIcon
          message="令牌仅此一次展示：落库即哈希，关闭后无法再次查看，请立即保存到安全的地方。"
        />
        <SecretText value={token} visible onToggle={() => {}} />
      </Space>
    ),
  });
}

function fmtTs(v?: string): string {
  return v && Number(v) > 0 ? new Date(Number(v) * 1000).toLocaleString() : "-";
}

export default function TelemetryTokensPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const view = useTenantView();
  // 当前租户的 telemetry 配置行（一租户一行，③懒建语义）；未找到 = 尚未
  // 建立，「生成」负责建立。appKey 仅作展示（行内凭据标识）。
  const [appKey, setAppKey] = useState<string | null>(null);

  const columns: ProColumns<API.v1IngestTokenInfo>[] = [
    {
      title: "前缀（标识）",
      dataIndex: "prefix",
      render: (_, r) => <code>{r.prefix}</code>,
    },
    {
      title: "状态",
      dataIndex: "revoked",
      width: 110,
      render: (_, r) =>
        r.revoked ? <Tag color="red">已吊销</Tag> : <Tag color="green">生效中</Tag>,
    },
    { title: "创建时间", dataIndex: "createdAt", width: 180, render: (_, r) => fmtTs(r.createdAt) },
    { title: "最近使用", dataIndex: "lastUsedAt", width: 180, render: (_, r) => fmtTs(r.lastUsedAt) },
    {
      title: "操作",
      valueType: "option",
      width: 120,
      render: (_, r) =>
        r.revoked
          ? [<span key="ro" style={{ color: "#999" }}>—</span>]
          : [
              <Popconfirm
                key="revoke"
                title="吊销该令牌？使用它的客户端上报将立即 401。"
                onConfirm={async () => {
                  if (!view.tenantKey) return;
                  try {
                    await revokeToken({ tenantKey: view.tenantKey, prefix: r.prefix ?? "" });
                    message.success("已吊销");
                    reload();
                  } catch (err) {
                    message.error(bizMessage(err, "吊销失败"));
                  }
                }}
              >
                <a style={{ color: "#cf1322" }}>吊销</a>
              </Popconfirm>,
            ],
    },
  ];

  // 无租户上下文（跨视图 / 零绑定）：本页无意义，提示选择租户。
  if (view.crossView || !view.tenantKey) {
    return (
      <PageContainer>
        <Alert
          type="info"
          showIcon
          message="请先在右上角选择租户"
          description="上报令牌按租户归属（一租户一配置行）。跨租户视图无单一租户上下文；平台员工的令牌运维请下钻到具体租户，或在「租户配置」的行内配置里操作。"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ProTable<API.v1IngestTokenInfo>
        headerTitle={`Ingest Tokens — ${view.tenantKey}`}
        actionRef={actionRef}
        columns={columns}
        rowKey="prefix"
        search={false}
        pagination={false}
        params={{ appKey }}
        request={async () => {
          // 配置行发现：telemetry ListTenantConfigs 1:1 透传，按注入租户键
          // 定位本租户的配置行；没有 = 令牌列表为空（待生成）。
          const resp = await listTenantConfigs();
          const mine = (resp.configs ?? []).find((a) => a.tenantKey === view.tenantKey);
          const key = mine?.appKey ?? null;
          setAppKey((cur) => (cur === key ? cur : key));
          if (!mine) return { data: [], success: true };
          const detail = await getTenantConfig({ tenantKey: view.tenantKey });
          return { data: detail.tokens ?? [], success: true };
        }}
        toolBarRender={() => [
          appKey ? (
            <Popconfirm
              key="rotate"
              title="轮换将新增一枚生效令牌（旧令牌保持有效，零停机）；确认？"
              onConfirm={async () => {
                try {
                  const resp = await rotateToken({ tenantKey: view.tenantKey }, {} as never);
                  message.success("已轮换");
                  showTokenOnce("新令牌（仅此一次）", resp.token ?? "");
                  reload();
                } catch (err) {
                  message.error(bizMessage(err, "轮换失败"));
                }
              }}
            >
              <Button type="primary">轮换令牌</Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              key="create"
              title="将为本租户建立上报配置行并铸出首枚令牌，确认？"
              onConfirm={async () => {
                try {
                  const resp = await createTenantConfig({
                    tenantKey: view.tenantKey,
                    name: view.tenantKey,
                  });
                  message.success("已生成本租户首枚令牌");
                  showTokenOnce("首枚令牌（仅此一次）", resp.token ?? "");
                  reload();
                } catch (err) {
                  message.error(bizMessage(err, "生成失败"));
                }
              }}
            >
              <Button type="primary">生成令牌</Button>
            </Popconfirm>
          ),
        ]}
      />
      <Space style={{ marginTop: 8, color: "#888" }}>
        <Typography.Text type="secondary">
          {appKey ? (
            <>
              配置行标识 <code>{appKey}</code>（服务端铸出的内部标识，非凭据）。业务方数据面凭据是门户 ak/sk（租户管理页）；AppSecret 机制已退役。
            </>
          ) : (
            "本租户尚未建立上报配置行——「生成令牌」会建立（与首次可信上报的懒建同构）并铸出首枚令牌。"
          )}
          轮换 = 追加一枚生效令牌（旧令牌保持有效，零停机切换），切换完成后吊销旧令牌收尾。
        </Typography.Text>
      </Space>
    </PageContainer>
  );
}
