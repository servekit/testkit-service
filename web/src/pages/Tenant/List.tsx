/**
 * 租户管理 · 租户列表（PLATFORM only，⑥ 验收重构）。
 *
 * 平台侧租户生命周期的唯一入口，吸收了原能力清单/成员管理两页的职责：
 * - 筛选：租户名称 / tenant_key（客户端过滤，注册表低基数无分页）
 * - 右上角「新建租户」：名称 + 能力勾选 + 可选引导管理员（邮箱新账号），
 *   响应里的 ak/sk 与初始密码仅弹窗展示一次
 * - 列：名称 / tenant_key / 状态 / 能力 / 管理员 / 创建时间
 * - 行操作：能力配置（抽屉开关）、管理员管理（抽屉绑定/解绑 = 更换管理员）、
 *   密钥管理（跳转预选）、编辑名称、停用/启用（kill-switch）、删除
 *   （软删，必须先停用，二次确认需回填 tenant_key）
 */
import { history } from "@umijs/max";
import {
  ModalForm,
  ProFormCheckbox,
  ProFormDigit,
  ProFormText,
} from "@ant-design/pro-components";
import {
  App,
  Alert,
  Button,
  Drawer,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { SecretText } from "@/components/SecretText";
import {
  portalAddTenantMember,
  portalCreateTenant,
  portalDeleteTenant,
  portalDisableTenant,
  portalListTenantMembers,
  portalListTenants,
  portalRemoveTenantMember,
  portalSetCapability,
  portalUpdateTenant,
} from "@/services/testkit/testkitService";

/** 五个能力服务的固定词表（与后端 capability 枚举一致）。 */
const CAPABILITY_SERVICES: { key: string; label: string; hint: string }[] = [
  { key: "USER", label: "用户服务", hint: "用户目录 / 认证 / RBAC" },
  { key: "MESSAGE", label: "消息服务", hint: "邮件 / 短信发送与记录" },
  { key: "STORAGE", label: "存储服务", hint: "文件上传 / 下载 / 配额" },
  { key: "TELEMETRY", label: "Telemetry 服务", hint: "事件上报与统计" },
  { key: "LICENSE", label: "License 服务", hint: "授权密钥与激活" },
];
const CAP_LABEL: Record<string, string> = Object.fromEntries(
  CAPABILITY_SERVICES.map((c) => [c.key, c.label]),
);

type Row = API.TenantInfo & { admins?: API.TenantMember[] };

function bizMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
}

/** 新建租户响应的一次性凭据弹窗（ak/sk + 可选初始密码）。 */
function showBootstrapSecrets(resp: API.v1CreateTenantResponse) {
  Modal.info({
    title: `租户已创建：${resp.tenantKey ?? ""}`,
    width: 680,
    content: (
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Alert
          type="warning"
          showIcon
          message="Secret 与初始密码仅此一次展示：关闭后无法再次查看，请立即保存到安全的地方。"
        />
        <div>
          <Typography.Text type="secondary">tenant_key：</Typography.Text>
          <Typography.Text code copyable>
            {resp.tenantKey ?? "-"}
          </Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">AccessKey：</Typography.Text>
          <Typography.Text code copyable>
            {resp.accessKey ?? "-"}
          </Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">Secret：</Typography.Text>
          <SecretText value={resp.secret} visible onToggle={() => {}} />
        </div>
        {resp.initialPassword ? (
          <div>
            <Typography.Text type="secondary">
              管理员初始密码（{resp.bootstrapUserId ? `user ${resp.bootstrapUserId}` : ""}）：
            </Typography.Text>
            <SecretText value={resp.initialPassword} visible onToggle={() => {}} />
          </div>
        ) : null}
      </Space>
    ),
  });
}

export default function TenantListPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();

  // ---- 数据：注册表 + 每租户管理员 fan-in ----
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await portalListTenants();
      const tenants = resp.tenants ?? [];
      const withAdmins = await Promise.all(
        tenants.map(async (t) => {
          try {
            const m = await portalListTenantMembers({ tenantKey: t.tenantKey ?? "" });
            return { ...t, admins: m.members ?? [] };
          } catch {
            return { ...t, admins: [] }; // 单租户成员拉取失败不拖垮整表
          }
        }),
      );
      setRows(withAdmins);
    } catch (err) {
      message.error(bizMessage(err, "租户列表加载失败"));
    } finally {
      setLoading(false);
    }
  }, [message]);
  useEffect(() => {
    load();
  }, [load]);

  // ---- 筛选（客户端） ----
  const [filterName, setFilterName] = useState("");
  const [filterKey, setFilterKey] = useState("");
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!filterName || (r.name ?? "").includes(filterName)) &&
          (!filterKey || (r.tenantKey ?? "").includes(filterKey)),
      ),
    [rows, filterName, filterKey],
  );

  // ---- 能力配置抽屉 ----
  const [capDrawer, setCapDrawer] = useState<Row | null>(null);
  const toggleCapability = async (svc: string, enabled: boolean) => {
    if (!capDrawer) return;
    try {
      await portalSetCapability(
        { tenantKey: capDrawer.tenantKey ?? "" },
        { service: svc, enabled },
      );
      message.success(`${CAP_LABEL[svc] ?? svc} 已${enabled ? "开启" : "关闭"}`);
      setRows((prev) =>
        prev.map((r) => {
          if (r.tenantKey !== capDrawer.tenantKey) return r;
          const caps = new Set(r.enabledCapabilities ?? []);
          enabled ? caps.add(svc) : caps.delete(svc);
          return { ...r, enabledCapabilities: [...caps] };
        }),
      );
      setCapDrawer((cur) => {
        if (!cur || cur.tenantKey !== capDrawer.tenantKey) return cur;
        const caps = new Set(cur.enabledCapabilities ?? []);
        enabled ? caps.add(svc) : caps.delete(svc);
        return { ...cur, enabledCapabilities: [...caps] };
      });
    } catch (err) {
      message.error(bizMessage(err, "能力开关失败"));
    }
  };

  // ---- 管理员抽屉 ----
  const [adminDrawer, setAdminDrawer] = useState<Row | null>(null);
  const reloadAdmins = async (tenantKey: string) => {
    try {
      const m = await portalListTenantMembers({ tenantKey });
      setRows((prev) =>
        prev.map((r) =>
          r.tenantKey === tenantKey ? { ...r, admins: m.members ?? [] } : r,
        ),
      );
      setAdminDrawer((cur) =>
        cur && cur.tenantKey === tenantKey ? { ...cur, admins: m.members ?? [] } : cur,
      );
    } catch (err) {
      message.error(bizMessage(err, "管理员列表刷新失败"));
    }
  };

  // ---- 删除（软删）：回填 tenant_key 的强确认 ----
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleteEcho, setDeleteEcho] = useState("");
  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await portalDeleteTenant(
        { tenantKey: deleteTarget.tenantKey ?? "" },
        { reason: "控制台删除" },
      );
      message.success(`已删除 ${deleteTarget.tenantKey}`);
      setDeleteTarget(null);
      setDeleteEcho("");
      load();
    } catch (err) {
      message.error(bizMessage(err, "删除失败"));
    }
  };

  const columns: ProColumns<Row>[] = [
    {
      title: "租户名称",
      dataIndex: "name",
      width: 160,
      ellipsis: true,
      render: (_, r) => (
        <Space size={4}>
          <span>{r.name || "-"}</span>
          {r.disabled ? <Tag color="red">已停用</Tag> : null}
        </Space>
      ),
    },
    {
      title: "租户 ID",
      dataIndex: "tenantKey",
      width: 170,
      render: (_, r) => (
        <Typography.Text code copyable style={{ fontSize: 12 }}>
          {r.tenantKey}
        </Typography.Text>
      ),
    },
    {
      title: "状态",
      dataIndex: "disabled",
      width: 80,
      render: (_, r) =>
        r.disabled ? <Tag color="red">已停用</Tag> : <Tag color="green">正常</Tag>,
    },
    {
      title: "能力",
      dataIndex: "enabledCapabilities",
      width: 260,
      render: (_, r) => {
        const caps = r.enabledCapabilities ?? [];
        if (!caps.length) return <Tag>无</Tag>;
        return (
          <Space size={4} wrap>
            {caps.map((c) => (
              <Tag key={c} color="blue">
                {CAP_LABEL[c] ?? c}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: "管理员",
      dataIndex: "admins",
      width: 200,
      render: (_, r) => {
        const admins = r.admins ?? [];
        if (!admins.length) return <Tag>未设置</Tag>;
        return (
          <Space size={4} wrap>
            {admins.map((m) => (
              <Tooltip key={m.userId} title={`user ${m.userId}`}>
                <Tag>{m.name || m.userId}</Tag>
              </Tooltip>
            ))}
          </Space>
        );
      },
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 160,
      render: (_, r) =>
        r.createdAt && Number(r.createdAt) > 0
          ? new Date(Number(r.createdAt) * 1000).toLocaleString()
          : "-",
    },
    {
      title: "操作",
      valueType: "option",
      width: 260,
      render: (_, r) => [
        <a
          key="caps"
          onClick={() => setCapDrawer(r)}
          style={r.disabled ? { color: "#999" } : undefined}
        >
          能力配置
        </a>,
        <a key="admins" onClick={() => setAdminDrawer(r)}>
          管理员
        </a>,
        <a
          key="keys"
          onClick={() =>
            history.push(`/tenant/credentials?tenant=${encodeURIComponent(r.tenantKey ?? "")}`)
          }
        >
          密钥
        </a>,
        <a
          key="toggle"
          onClick={async () => {
            try {
              await portalDisableTenant(
                { tenantKey: r.tenantKey ?? "" },
                { disable: !r.disabled, reason: "控制台切换" },
              );
              message.success(r.disabled ? "已启用" : "已停用");
              load();
            } catch (err) {
              message.error(bizMessage(err, "操作失败"));
            }
          }}
        >
          {r.disabled ? "启用" : "停用"}
        </a>,
        <Typography.Text
          key="delete"
          type={r.disabled ? "danger" : "secondary"}
          style={{ cursor: r.disabled ? "pointer" : "not-allowed", fontSize: 13 }}
          onClick={() => {
            if (!r.disabled) {
              message.warning("请先停用租户，再删除（删除不可恢复）");
              return;
            }
            setDeleteTarget(r);
            setDeleteEcho("");
          }}
        >
          删除
        </Typography.Text>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<Row>
        headerTitle="租户列表"
        actionRef={actionRef}
        columns={columns}
        dataSource={filtered}
        loading={loading}
        rowKey="tenantKey"
        search={false}
        pagination={false}
        toolBarRender={() => [
          <Input.Search
            key="f-name"
            allowClear
            placeholder="按租户名称筛选"
            style={{ width: 180 }}
            onSearch={setFilterName}
          />,
          <Input.Search
            key="f-key"
            allowClear
            placeholder="按租户 ID（tenant_key）筛选"
            style={{ width: 220 }}
            onSearch={setFilterKey}
          />,
          <ModalForm
            key="create"
            title="新建租户"
            width={520}
            initialValues={{ capabilities: CAPABILITY_SERVICES.map((c) => c.key) }}
            onFinish={async (vals) => {
              try {
                const resp = await portalCreateTenant({
                  name: vals.name,
                  capabilities: vals.capabilities ?? [],
                  admin: vals.adminEmail
                    ? {
                        newAccount: {
                          name: vals.adminName || vals.name,
                          email: vals.adminEmail,
                        },
                      }
                    : undefined,
                });
                message.success("租户已创建");
                showBootstrapSecrets(resp);
                load();
                return true;
              } catch (err) {
                message.error(bizMessage(err, "创建失败"));
                return false;
              }
            }}
            trigger={
              <Button type="primary">新建租户</Button>
            }
          >
            <ProFormText
              name="name"
              label="租户名称"
              rules={[{ required: true, message: "请输入租户名称" }]}
            />
            <ProFormCheckbox.Group
              name="capabilities"
              label="开通能力"
              options={CAPABILITY_SERVICES.map((c) => ({
                label: c.label,
                value: c.key,
              }))}
            />
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              引导管理员（可选）：填写邮箱将创建租户管理员的控制台账号并绑定，
              初始密码在创建完成后仅展示一次；留空则稍后在「管理员」里绑定。
            </Typography.Paragraph>
            <ProFormText
              name="adminName"
              label="管理员名称"
              placeholder="留空则使用租户名称"
            />
            <ProFormText
              name="adminEmail"
              label="管理员邮箱"
              placeholder="例如 admin@example.com"
              rules={[{ type: "email", message: "邮箱格式不正确" }]}
            />
          </ModalForm>,
        ]}
      />

      {/* 能力配置抽屉 */}
      <Drawer
        title={`能力配置 — ${capDrawer?.name ?? ""}（${capDrawer?.tenantKey ?? ""}）`}
        width={420}
        open={!!capDrawer}
        onClose={() => setCapDrawer(null)}
      >
        {capDrawer?.disabled ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="租户已停用：先启用租户才能调整能力。"
          />
        ) : null}
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {CAPABILITY_SERVICES.map((c) => (
            <div
              key={c.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div>{c.label}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {c.hint}
                </Typography.Text>
              </div>
              <Switch
                checked={(capDrawer?.enabledCapabilities ?? []).includes(c.key)}
                disabled={!!capDrawer?.disabled}
                onChange={(v) => toggleCapability(c.key, v)}
              />
            </div>
          ))}
        </Space>
      </Drawer>

      {/* 管理员抽屉（绑定/解绑 = 更换管理员） */}
      <Drawer
        title={`管理员 — ${adminDrawer?.name ?? ""}（${adminDrawer?.tenantKey ?? ""}）`}
        width={520}
        open={!!adminDrawer}
        onClose={() => setAdminDrawer(null)}
      >
        <Table<API.TenantMember>
          size="small"
          rowKey="userId"
          pagination={false}
          dataSource={adminDrawer?.admins ?? []}
          columns={[
            {
              title: "用户 ID",
              dataIndex: "userId",
              width: 150,
              render: (v) => <code>{v}</code>,
            },
            { title: "用户名", dataIndex: "name" },
            {
              title: "绑定时间",
              dataIndex: "createdAt",
              width: 160,
              render: (v) =>
                v && Number(v) > 0 ? new Date(Number(v) * 1000).toLocaleString() : "-",
            },
            {
              title: "操作",
              width: 70,
              render: (_, m) => (
                <Popconfirm
                  title={`解绑 ${m.name ?? m.userId}？解绑后立即失去本租户控制台操作权。`}
                  onConfirm={async () => {
                    try {
                      await portalRemoveTenantMember({
                        tenantKey: adminDrawer?.tenantKey ?? "",
                        userId: m.userId ?? "0",
                      });
                      message.success("已解绑");
                      reloadAdmins(adminDrawer?.tenantKey ?? "");
                    } catch (err) {
                      message.error(bizMessage(err, "解绑失败"));
                    }
                  }}
                >
                  <a style={{ color: "#cf1322" }}>解绑</a>
                </Popconfirm>
              ),
            },
          ]}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 8 }}>
          绑定新管理员（更换管理员 = 绑定新账号后解绑旧账号）。仅可绑定已有控制台账号
          （用户运营中创建的 TENANT_ADMIN）的 user_id。
        </Typography.Paragraph>
        <ModalForm
          key="add"
          title="绑定管理员"
          width={420}
          onFinish={async (vals) => {
            try {
              await portalAddTenantMember(
                { tenantKey: adminDrawer?.tenantKey ?? "" },
                { userId: String(vals.userId) },
              );
              message.success("已绑定");
              reloadAdmins(adminDrawer?.tenantKey ?? "");
              return true;
            } catch (err) {
              message.error(bizMessage(err, "绑定失败"));
              return false;
            }
          }}
          trigger={<Button type="primary">绑定管理员</Button>}
        >
          <ProFormDigit
            name="userId"
            label="user_id"
            min={1}
            fieldProps={{ precision: 0 }}
            rules={[{ required: true, message: "请输入 user_id" }]}
          />
        </ModalForm>
      </Drawer>

      {/* 删除强确认：回填 tenant_key */}
      <Modal
        title={`删除租户 ${deleteTarget?.name ?? ""}`}
        open={!!deleteTarget}
        okText="确认删除"
        okButtonProps={{
          danger: true,
          disabled: !deleteTarget || deleteEcho !== deleteTarget.tenantKey,
        }}
        onOk={doDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            message="删除不可恢复：租户将从注册表消失，tenant_key 永不复用；各服务内该租户的数据将保留（退订语义）。"
          />
          <div>
            请输入租户 ID <code>{deleteTarget?.tenantKey}</code> 以确认：
          </div>
          <Input
            placeholder={deleteTarget?.tenantKey}
            value={deleteEcho}
            onChange={(e) => setDeleteEcho(e.target.value)}
          />
        </Space>
      </Modal>
    </PageContainer>
  );
}
