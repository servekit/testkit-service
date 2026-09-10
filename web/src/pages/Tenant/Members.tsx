/**
 * 租户管理 · 成员管理（PLATFORM only，tenant platform spec §5.1/§7.2）。
 *
 * tenant_members = 租户的控制台运营者绑定：把一个已有控制台账号（ten_platform
 * 目录下的 TENANT_ADMIN）绑到该租户。页面按目标租户列出绑定、支持绑定/
 * 解绑（AddTenantMember / RemoveTenantMember，后者幂等）。
 */
import {
  ModalForm,
  ProFormDigit,
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
import { readTenantChoice } from "@/utils/tenantChoice";

function bizMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
}

export default function TenantMembersPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();

  const [tenants, setTenants] = useState<API.TenantInfo[]>([]);
  const [tenantKey, setTenantKey] = useState<string>(readTenantChoice());
  useEffect(() => {
    let alive = true;
    portalListTenants()
      .then((resp) => {
        if (!alive) return;
        const list = resp.tenants ?? [];
        setTenants(list);
        setTenantKey((cur) =>
          cur && list.some((t) => t.tenantKey === cur)
            ? cur
            : (list[0]?.tenantKey ?? ""),
        );
      })
      .catch((err) => message.error(bizMessage(err, "租户列表加载失败")));
    return () => {
      alive = false;
    };
  }, [message]);

  type Row = API.TenantMember;

  const columns: ProColumns<Row>[] = [
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
          title={`解绑 ${r.name ?? r.userId}？解绑后该账号立即失去本租户的控制台操作权。`}
          onConfirm={async () => {
            try {
              await portalRemoveTenantMember({
                tenantKey,
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
        headerTitle="控制台运营者"
        actionRef={actionRef}
        columns={columns}
        rowKey="userId"
        search={false}
        pagination={false}
        params={{ tenantKey }}
        request={async ({ tenantKey: tk }) => {
          if (!tk) return { data: [], success: true };
          const resp = await portalListTenantMembers({
            tenantKey: tk as string,
          });
          return { data: resp.members ?? [], success: true };
        }}
        toolBarRender={() => [
          <Select
            key="tenant"
            size="small"
            style={{ minWidth: 220 }}
            popupMatchSelectWidth={false}
            showSearch
            optionFilterProp="label"
            placeholder="选择租户"
            value={tenantKey || undefined}
            onChange={setTenantKey}
            options={tenants.map((t) => ({
              value: t.tenantKey ?? "",
              label: t.name ? `${t.name}（${t.tenantKey}）` : (t.tenantKey ?? ""),
            }))}
          />,
          <ModalForm
            key="add"
            title="绑定控制台运营者"
            width={480}
            disabled={!tenantKey}
            onFinish={async (vals) => {
              try {
                await portalAddTenantMember(
                  { tenantKey },
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
              <Button type="primary" disabled={!tenantKey}>
                绑定成员
              </Button>
            }
          >
            <Typography.Paragraph type="secondary">
              仅可绑定已有控制台账号（用户运营中创建的 TENANT_ADMIN 账号）的
              user_id；新账号请先在「用户运营」创建。
            </Typography.Paragraph>
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
