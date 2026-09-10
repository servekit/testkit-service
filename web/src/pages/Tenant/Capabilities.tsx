/**
 * 租户管理 · 能力清单（tenant platform spec §5.3/§6.1）。
 *
 * - TENANT_ADMIN：只读。MyCapabilities 返回所绑定租户能力并集（多绑定时是
 *   全部绑定租户的并集——接口是 actor 级的，不分租户）。
 * - PLATFORM：可改。ListTenants 的注册表全表，行内五个能力服务开关
 *   （SetCapability）+ 租户停用 kill-switch（DisableTenant，停用后所有租户
 *   级面立即失效）。
 */
import { useModel } from "@umijs/max";
import {
  App,
  Alert,
  Card,
  Popconfirm,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { useEffect, useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  portalDisableTenant,
  portalListTenants,
  portalMyCapabilities,
  portalSetCapability,
} from "@/services/testkit/testkitService";

const USER_TYPE_PLATFORM = "USER_TYPE_PLATFORM";

/** 五个能力服务的固定词表（gid/reference/portal 是平台管线，永不出现）。 */
const CAPABILITY_SERVICES: { key: string; label: string; hint: string }[] = [
  { key: "USER", label: "用户服务", hint: "用户目录 / 认证 / RBAC" },
  { key: "MESSAGE", label: "消息服务", hint: "邮件 / 短信发送与记录" },
  { key: "STORAGE", label: "存储服务", hint: "文件上传 / 下载 / 配额" },
  { key: "TELEMETRY", label: "Telemetry 服务", hint: "事件上报与统计" },
  { key: "LICENSE", label: "License 服务", hint: "授权密钥与激活" },
];

const CAP_KEYS = CAPABILITY_SERVICES.map((c) => c.key);

function bizMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
}

/** TENANT_ADMIN 只读视图：能力并集。 */
function TenantAdminCapabilities() {
  const [capabilities, setCapabilities] = useState<string[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    portalMyCapabilities()
      .then((resp) => {
        if (!alive) return;
        setCapabilities(resp.capabilities ?? []);
        setError("");
      })
      .catch((err) => {
        if (alive) setError(bizMessage(err, "加载失败"));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Card title="已启用能力（所绑定租户的并集）" loading={capabilities === null && !error}>
      {error && <Alert type="error" showIcon message={error} />}
      {!error && (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            多绑定管理员看到的是全部绑定租户能力的并集；单个租户的能力以平台侧配置为准，租户侧只读。
          </Typography.Text>
          <Space wrap size={12}>
            {CAPABILITY_SERVICES.map((svc) => {
              const on = capabilities?.includes(svc.key) ?? false;
              return (
                <Card key={svc.key} size="small" style={{ width: 220 }}>
                  <Space direction="vertical" size={4}>
                    <Space>
                      <Tag color={on ? "green" : "default"}>{on ? "已启用" : "未启用"}</Tag>
                      <Typography.Text strong>{svc.label}</Typography.Text>
                    </Space>
                    <Typography.Text type="secondary">{svc.hint}</Typography.Text>
                  </Space>
                </Card>
              );
            })}
          </Space>
        </Space>
      )}
    </Card>
  );
}

/** PLATFORM 管理视图：注册表全表 + 行内开关。 */
function PlatformTenants() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const withBusy = (key: string, fn: () => Promise<unknown>, ok: string) =>
    async () => {
      setBusy((b) => ({ ...b, [key]: true }));
      try {
        await fn();
        message.success(ok);
        reload();
      } catch (err) {
        message.error(bizMessage(err, "操作失败"));
      } finally {
        setBusy((b) => ({ ...b, [key]: false }));
      }
    };

  type Row = API.TenantInfo;

  const columns: ProColumns<Row>[] = [
    { title: "租户名称", dataIndex: "name", width: 180, ellipsis: true },
    {
      title: "tenant_key",
      dataIndex: "tenantKey",
      width: 170,
      render: (_, r) => <code>{r.tenantKey}</code>,
    },
    {
      title: "能力",
      dataIndex: "enabledCapabilities",
      width: 420,
      render: (_, r) => (
        <Space wrap size={8}>
          {CAPABILITY_SERVICES.map((svc) => {
            const on = r.enabledCapabilities?.includes(svc.key) ?? false;
            const busyKey = `${r.tenantKey}:${svc.key}`;
            return (
              <span key={svc.key}>
                <Switch
                  size="small"
                  checked={on}
                  loading={!!busy[busyKey]}
                  onChange={withBusy(
                    busyKey,
                    () =>
                      portalSetCapability(
                        { tenantKey: r.tenantKey ?? "" },
                        { service: svc.key, enabled: !on },
                      ),
                    on ? `已停用 ${svc.label}` : `已启用 ${svc.label}`,
                  )}
                />{" "}
                <Typography.Text type={on ? undefined : "secondary"}>
                  {svc.label}
                </Typography.Text>
              </span>
            );
          })}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "disabled",
      width: 90,
      render: (_, r) =>
        r.disabled ? <Tag color="red">已停用</Tag> : <Tag color="green">正常</Tag>,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 170,
      render: (_, r) =>
        r.createdAt && Number(r.createdAt) > 0
          ? new Date(Number(r.createdAt) * 1000).toLocaleString()
          : "-",
    },
    {
      title: "操作",
      valueType: "option",
      width: 100,
      render: (_, r) => [
        <Popconfirm
          key="toggle"
          title={
            r.disabled
              ? `重新启用租户 ${r.name ?? r.tenantKey}？`
              : `停用租户 ${r.name ?? r.tenantKey}？停用后其全部租户级服务立即失效。`
          }
          onConfirm={withBusy(
            `${r.tenantKey}:tenant`,
            () =>
              portalDisableTenant(
                { tenantKey: r.tenantKey ?? "" },
                { disable: !r.disabled, reason: "控制台切换" },
              ),
            r.disabled ? "已重新启用" : "已停用",
          )}
        >
          <a>{r.disabled ? "启用" : "停用"}</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<Row>
      headerTitle="租户注册表"
      actionRef={actionRef}
      columns={columns}
      rowKey="tenantKey"
      search={false}
      pagination={false}
      request={async () => {
        const resp = await portalListTenants();
        return { data: resp.tenants ?? [], success: true };
      }}
    />
  );
}

export default function TenantCapabilitiesPage() {
  const { initialState } = useModel("@@initialState");
  const isPlatform =
    initialState?.currentUser?.userType === USER_TYPE_PLATFORM;
  return (
    <PageContainer>
      {isPlatform ? <PlatformTenants /> : <TenantAdminCapabilities />}
    </PageContainer>
  );
}
