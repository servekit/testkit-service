/**
 * 租户管理 · 成员管理（PLATFORM only，tenant platform spec §5.1/§7.2）。
 *
 * tenant_members = 租户的控制台运营者绑定：把一个已有控制台账号（ten_platform
 * 目录下的 TENANT_ADMIN）绑到该租户。平台视角是全租户平铺（每行带租户列，
 * 可按租户筛选），绑定/解绑走 AddTenantMember / RemoveTenantMember（后者幂等）。
 */
import {
  ModalForm,
  ProFormDigit,
  ProFormSelect,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Select, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  portalAddTenantMember,
  portalListTenantMembers,
  portalListTenants,
  portalRemoveTenantMember,
} from "@/services/testkit/testkitService";

function bizMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
}

type Row = API.TenantMember & { tenantKey?: string; tenantName?: string };

export default function TenantMembersPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();

  const [tenants, setTenants] = useState<API.TenantInfo[]>([]);
  // "" = 全部租户（平台视角默认平铺）
  const [filterTenantKey, setFilterTenantKey] = useState<string>("");
  useEffect(() => {
    let alive = true;
    portalListTenants()
      .then((resp) => {
        if (alive) setTenants(resp.tenants ?? []);
      })
      .catch((err) => message.error(bizMessage(err, "租户列表加载失败")));
    return () => {
      alive = false;
    };
  }, [message]);

  const tenantLabel = (t: API.TenantInfo) =>
    t.name ? `${t.name}（${t.tenantKey}）` : (t.tenantKey ?? "");

  const columns: ProColumns<Row>[] = [
    {
      title: "租户",
      dataIndex: "tenantKey",
      width: 240,
      render: (_, r) =>
        r.tenantName ? (
          <>
            {r.tenantName} <code>{r.tenantKey}</code>
          </>
        ) : (
          <code>{r.tenantKey}</code>
        ),
    },
    {
      title: "用户 ID",
      dataIndex: "userId",
      width: 140,
      render: (_, r) => <code>{r.userId}</code>,
    },
    { title: "用户名", dataIndex: "name", ellipsis: true },
    {
      title: "绑定时间",
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
          key="remove"
          title={`解绑 ${r.name ?? r.userId}？解绑后该账号立即失去 ${r.tenantKey} 的控制台操作权。`}
          onConfirm={async () => {
            try {
              await portalRemoveTenantMember({
                tenantKey: r.tenantKey ?? "",
                userId: r.userId ?? "0",
              });
              message.success("已解绑");
              reload();
            } catch (err) {
              message.error(bizMessage(err, "解绑失败"));
            }
          }}
        >
          <a>解绑</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<Row>
        headerTitle="控制台运营者（全租户）"
        actionRef={actionRef}
        columns={columns}
        rowKey={(r) => `${r.tenantKey}:${r.userId}`}
        search={false}
        pagination={false}
        params={{ filterTenantKey, tenants }}
        request={async ({ filterTenantKey: f, tenants: ts }) => {
          const list = (ts as API.TenantInfo[]) ?? [];
          if (!list.length) return { data: [], success: true };
          const targets =
            f && list.some((t) => t.tenantKey === f)
              ? list.filter((t) => t.tenantKey === f)
              : list;
          const rows = await Promise.all(
            targets.map(async (t) => {
              try {
                const resp = await portalListTenantMembers({
                  tenantKey: t.tenantKey ?? "",
                });
                return (resp.members ?? []).map((m) => ({
                  ...m,
                  tenantKey: t.tenantKey,
                  tenantName: t.name,
                }));
              } catch {
                // 单个租户拉取失败不拖垮整表（错误行跳过，刷新可重试）
                return [];
              }
            }),
          );
          return { data: rows.flat(), success: true };
        }}
        toolBarRender={() => [
          <Select
            key="tenant-filter"
            size="small"
            style={{ minWidth: 220 }}
            popupMatchSelectWidth={false}
            showSearch
            optionFilterProp="label"
            placeholder="全部租户"
            value={filterTenantKey || undefined}
            onChange={(v) => setFilterTenantKey(v ?? "")}
            allowClear
            options={tenants.map((t) => ({
              value: t.tenantKey ?? "",
              label: tenantLabel(t),
            }))}
          />,
          <ModalForm
            key="add"
            title="绑定控制台运营者"
            width={480}
            onFinish={async (vals) => {
              if (!vals.tenantKey) {
                message.error("请选择租户");
                return false;
              }
              try {
                await portalAddTenantMember(
                  { tenantKey: vals.tenantKey },
                  { userId: String(vals.userId) },
                );
                message.success("已绑定");
                reload();
                return true;
              } catch (err) {
                message.error(bizMessage(err, "绑定失败"));
                return false;
              }
            }}
            trigger={
              <Button type="primary" disabled={!tenants.length}>
                绑定成员
              </Button>
            }
          >
            <Typography.Paragraph type="secondary">
              仅可绑定已有控制台账号（用户运营中创建的 TENANT_ADMIN 账号）的
              user_id；新账号请先在「用户运营」创建。
            </Typography.Paragraph>
            <ProFormSelect
              name="tenantKey"
              placeholder="选择租户"
              options={tenants.map((t) => ({
                value: t.tenantKey ?? "",
                label: tenantLabel(t),
              }))}
              rules={[{ required: true, message: "请选择租户" }]}
            />
            <ProFormDigit
              name="userId"
              label="user_id"
              min={1}
              fieldProps={{ precision: 0 }}
              rules={[{ required: true, message: "请输入 user_id" }]}
            />
          </ModalForm>,
        ]}
      />
    </PageContainer>
  );
}
