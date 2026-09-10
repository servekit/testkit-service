/**
 * 消息平台 · 租户配置（④T6 更名，原「应用管理」）。每个租户一行配置，
 * 行内保留调用方凭据（app_key/app_secret，列表可见——内网信任 posture）：
 * 默认掩码，点眼睛显示明文、点复制取值，方便配置到发送端的
 * message.app_key / message.secret。
 * 归属列展示 tenant_key；跨视图（PLATFORM）带租户筛选器；下钻视图创建的
 * 配置自动挂当前租户。本页保持平台运营面（路由 access: canPlatform）。
 */
import { ModalForm, ProFormDigit, ProFormText } from "@ant-design/pro-components";
import { App, Button, Popconfirm, Space, Tag } from "antd";
import { useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { SecretText } from "@/components/SecretText";
import {
  messageCreateTenantConfig,
  messageDeleteTenantConfig,
  messageListTenantConfigs,
  messageRotateTenantConfigSecret,
  messageUpdateTenantConfig,
} from "@/services/testkit/testkitService";
import {
  TenantFilterSelect,
  applyTenantFilter,
  filterTenantRows,
  renderTenantScope,
  tenantFilterOptions,
  useTenantView,
} from "@/components/tenantScope";

export default function MessageAppsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const view = useTenantView();
  // 跨视图租户筛选（选项来自已加载行的 tenant_key 去重）。
  const [tenantFilter, setTenantFilter] = useState<string>("__all__");
  const [filterOptions, setFilterOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "__all__", label: "全部租户" }]);
  // 掩码开关按 "id:字段" 记忆；创建/轮换后自动点亮对应行的 AppSecret
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggleReveal = (key: string) =>
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  const reveal = (id: string | undefined, field: string) => {
    if (id) setRevealed((prev) => ({ ...prev, [`${id}:${field}`]: true }));
  };

  const columns: ProColumns<API.v1MessageTenantConfigInfo>[] = [
    { title: "名称", dataIndex: "name", hideInSearch: true, width: 140, ellipsis: true },
    {
      title: "归属",
      dataIndex: "tenantKey",
      width: 150,
      render: (_, r) => renderTenantScope(view, r.tenantKey),
    },
    {
      title: "AppKey",
      dataIndex: "appKey",
      width: 240,
      render: (_, r) => (
        <SecretText
          value={r.appKey}
          visible={!!revealed[`${r.id}:appKey`]}
          onToggle={() => toggleReveal(`${r.id}:appKey`)}
        />
      ),
    },
    {
      title: "AppSecret",
      dataIndex: "appSecret",
      width: 420,
      render: (_, r) => (
        <SecretText
          value={r.appSecret}
          visible={!!revealed[`${r.id}:appSecret`]}
          onToggle={() => toggleReveal(`${r.id}:appSecret`)}
        />
      ),
    },
    {
      title: "状态",
      dataIndex: "disabled",
      hideInSearch: true,
      width: 80,
      render: (_, r) => (r.disabled ? <Tag color="red">停用</Tag> : <Tag color="green">启用</Tag>),
    },
    {
      title: "短信日上限",
      dataIndex: "smsDailyLimit",
      hideInSearch: true,
      width: 100,
      render: (_, r) => (Number(r.smsDailyLimit) > 0 ? Number(r.smsDailyLimit) : "不限"),
    },
    {
      title: "邮件日上限",
      dataIndex: "emailDailyLimit",
      hideInSearch: true,
      width: 100,
      render: (_, r) => (Number(r.emailDailyLimit) > 0 ? Number(r.emailDailyLimit) : "不限"),
    },
    {
      title: "操作",
      valueType: "option",
      width: 200,
      render: (_, r) => [
        <a
          key="rotate"
          onClick={async () => {
            try {
              await messageRotateTenantConfigSecret({ id: r.id! }, {} as never);
              message.success("已轮换，新 AppSecret 见列表");
              reveal(r.id, "appSecret");
              reload();
            } catch (err) {
              const e = err as { data?: { message?: string } };
              message.error(e?.data?.message ?? "轮换失败");
            }
          }}
        >
          轮换密钥
        </a>,
        <a
          key="toggle"
          onClick={async () => {
            try {
              await messageUpdateTenantConfig({ id: r.id! }, { disabled: !r.disabled });
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
          title="删除后该租户的发送立即失败，确定？"
          onConfirm={async () => {
            try {
              await messageDeleteTenantConfig({ id: r.id! });
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
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.v1MessageTenantConfigInfo>
        headerTitle="租户配置列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        scroll={{ x: 1280 }}
        params={{ tenantFilter }}
        request={async () => {
          const resp = await messageListTenantConfigs({});
          // 下钻视图只看当前租户的配置行（其余租户行对下钻语义不可见）。
          let rows = filterTenantRows(view, resp.configs ?? [], (r) => r.tenantKey);
          if (view.crossView) {
            setFilterOptions(tenantFilterOptions(resp.configs ?? [], (r) => r.tenantKey));
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
            title="创建租户配置"
            trigger={<Button type="primary">创建租户配置</Button>}
            onFinish={async (vals) => {
              try {
                const resp = await messageCreateTenantConfig({
                  name: vals.name,
                  smsDailyLimit: String(Number(vals.smsDailyLimit ?? 0)),
                  emailDailyLimit: String(Number(vals.emailDailyLimit ?? 0)),
                  // 租户归属：租户视图（下钻）建的配置挂当前租户；跨视图
                  // 留空 = 服务端铸造键字面量（legacy→tenant 回退值）。
                  tenantKey: view.crossView ? "" : view.tenantKey,
                });
                message.success("已创建，AppKey/AppSecret 见列表");
                reveal(resp.config?.id, "appSecret");
                reload();
                return true;
              } catch (err) {
                const e = err as { data?: { message?: string } };
                message.error(e?.data?.message ?? "创建失败");
                return false;
              }
            }}
          >
            <ProFormText name="name" label="名称" rules={[{ required: true }]} />
            <ProFormDigit
              name="smsDailyLimit"
              label="短信日上限（0=不限）"
              min={0}
              fieldProps={{ precision: 0 }}
            />
            <ProFormDigit
              name="emailDailyLimit"
              label="邮件日上限（0=不限）"
              min={0}
              fieldProps={{ precision: 0 }}
            />
          </ModalForm>,
        ]}
      />
      <Space style={{ marginTop: 8, color: "#888" }}>
        凭据即权限：app_key/app_secret 由系统生成，列表默认掩码；点眼睛显示明文、点复制取值，配置到发送端的
        message.app_key / message.app_secret。轮换后旧 secret 立即失效。
      </Space>
    </PageContainer>
  );
}
