/**
 * 消息平台 · 签名管理。短信签名（国内）/ sender ID（国际），
 * 与通道账号多对多绑定（报备关系）；策略路由按绑定校验。
 * phase ④ 租户化：平台池（tenant_key NULL）与租户私有按「归属」区分——
 * 租户视图平台池行标「平台共享」只读、私有行「本租户」可管，创建默认
 * 私有；跨视图（PLATFORM）全量 + 租户筛选器。报备账号下拉同步收窄到
 * 本租户可用域（平台池 + 本租户私有，与后端域校验一致）。
 */
import {
  ModalForm,
  ProFormSelect,
  ProFormTextArea,
  ProFormText,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Tag } from "antd";
import { useEffect, useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  messageCreateSignature,
  messageDeleteSignature,
  messageListChannelAccounts,
  messageListSignatures,
  messageUpdateSignature,
} from "@/services/testkit/testkitService";
import {
  TenantFilterSelect,
  applyTenantFilter,
  filterTenantRows,
  renderTenantScope,
  tenantFilterOptions,
  useTenantView,
} from "@/components/tenantScope";

export default function MessageSignaturesPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const view = useTenantView();
  // 跨视图租户筛选（选项来自已加载行的 tenant_key 去重）。
  const [tenantFilter, setTenantFilter] = useState<string>("__all__");
  const [filterOptions, setFilterOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "__all__", label: "全部租户" }]);

  // SMS accounts for the binding multi-select. Tenant view offers the
  // tenant-scoped subset only (pool + own) — the server's binding domain
  // check would reject cross-tenant references anyway.

  const [smsAccounts, setSmsAccounts] = useState<{ label: string; value: string }[]>([]);
  useEffect(() => {
    void messageListChannelAccounts().then((resp) => {
      const items = filterTenantRows(
        view,
        (resp.accounts ?? []).filter(
          (a) => a.smsVendor,
        ),
        (a) => a.tenantKey,
      );
      setSmsAccounts(items.map((a) => ({ label: `${a.name}（#${a.id}）`, value: a.id as string })));
    });
  }, [view.tenantKey, view.crossView]);

  const columns: ProColumns<API.v1SignatureInfo>[] = [
    { title: "ID", dataIndex: "id", width: 90 },
    { title: "签名 / Sender ID", dataIndex: "name", copyable: true },
    {
      title: "归属",
      dataIndex: "tenantKey",
      width: 150,
      render: (_, r) => renderTenantScope(view, r.tenantKey),
    },
    {
      title: "已报备账号",
      dataIndex: "accountIds",
      render: (_, r) =>
        (r.accountIds ?? []).map((id) => (
          <Tag key={id}>#{id}</Tag>
        )),
    },
    { title: "备注", dataIndex: "remark" },
    {
      title: "状态",
      dataIndex: "disabled",
      width: 80,
      render: (_, r) => (r.disabled ? <Tag color="red">停用</Tag> : <Tag color="green">启用</Tag>),
    },
    {
      title: "操作",
      valueType: "option",
      width: 200,
      render: (_, r) => {
        // 平台池行是共享基础设施：租户视图（非平台员工）只读。
        if (!view.canManage(r.tenantKey)) {
          return [<span key="ro" style={{ color: "#999" }}>平台维护</span>];
        }
        return [
          <a
            key="toggle"
            onClick={async () => {
              try {
                await messageUpdateSignature({ id: r.id! }, { disabled: !r.disabled });
                message.success(r.disabled ? "已启用" : "已停用");
                reload();
              } catch (err) {
                const e = err as { data?: { message?: string } };
                message.error(e?.data?.message ?? "操作失败");
              }
            }}
          >
            {r.disabled ? "启用" : "停用"}
          </a>,
          <Popconfirm
            key="del"
            title="删除后引用它的策略路由将失败，确定？"
            onConfirm={async () => {
              try {
                await messageDeleteSignature({ id: r.id } as never);
                message.success("已删除");
                reload();
              } catch (err) {
                const e = err as { data?: { message?: string } };
                message.error(e?.data?.message ?? "删除失败");
              }
            }}
          >
            <a style={{ color: "#cf1322" }}>删除</a>
          </Popconfirm>,
        ];
      },
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.v1SignatureInfo>
        headerTitle="签名列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        params={{ tenantFilter }}
        request={async () => {
          const resp = await messageListSignatures();
          let rows = filterTenantRows(view, resp.signatures ?? [], (r) => r.tenantKey);
          if (view.crossView) {
            setFilterOptions(tenantFilterOptions(resp.signatures ?? [], (r) => r.tenantKey));
            rows = applyTenantFilter(tenantFilter, rows, (r) => r.tenantKey);
          }
          return { data: rows, success: true };
        }}
        toolBarRender={() => [
          view.crossView ? (
            <TenantFilterSelect
              key="tenant-filter"
              value={tenantFilter}
              onChange={setTenantFilter}
              options={filterOptions}
            />
          ) : null,
          <ModalForm
            key="create"
            title="新建签名"
            trigger={<Button type="primary">新建签名</Button>}
            onFinish={async (vals) => {
              try {
                await messageCreateSignature({
                  name: vals.name,
                  remark: vals.remark ?? "",
                  accountIds: vals.accountIds,
                  // 归属：租户视图默认本租户（私有）；跨视图（平台）入平台池。
                  tenantKey: view.crossView ? "" : (vals.tenantKey || ""),
                } as never);
                message.success("已创建");
                reload();
                return true;
              } catch (err) {
                const e = err as { data?: { message?: string } };
                message.error(e?.data?.message ?? "创建失败");
                return false;
              }
            }}
          >
            <ProFormText
              name="name"
              label="签名串 / Sender ID"
              placeholder='国内如 "XX科技"；国际如 "MyApp"'
              rules={[{ required: true }]}
            />
            {!view.crossView && (
              <ProFormSelect
                name="tenantKey"
                label="归属"
                initialValue={view.tenantKey}
                // 平台池归平台管（服务端只读裁定，phase ④ T5）——租户视图
                // 只能创建本租户私有资源，不再提供「平台共享」选项。
                options={[{ value: view.tenantKey, label: `本租户（${view.tenantKey}）` }]}
              />
            )}
            <ProFormSelect
              name="accountIds"
              label="已报备账号（多选）"
              mode="multiple"
              options={smsAccounts}
              rules={[{ required: true }]}
            />
            <ProFormTextArea name="remark" label="备注" />
          </ModalForm>,
        ]}
      />
    </PageContainer>
  );
}
