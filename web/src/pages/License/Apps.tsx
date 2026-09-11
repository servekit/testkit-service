/**
 * License 平台 · 租户配置（④T6 更名，原「应用管理」）。与消息/存储平台同一
 * 套交互：每个租户一行配置。④ 窗口关闭后配置行不再携带凭据（app_secret 列
 * 已删）：数据面调用经 portal 入口注入可信 x-tenant-key，而非 ak/sk。注意
 * 区分：配置行是接入方身份，不是终端用户的 License Key（密钥管理在另一页）。
 */
import { ModalForm, ProFormText } from "@ant-design/pro-components";
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
  licenseCreateTenantConfig,
  licenseDeleteTenantConfig,
  licenseListTenantConfigs,
  licenseUpdateTenantConfig,
} from "@/services/testkit/testkitService";

export default function LicenseAppsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  // 掩码开关按 "appKey:字段" 记忆（AppKey 是行的机器标识）
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggleReveal = (key: string) =>
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));

  const columns: ProColumns<API.v1LicenseTenantConfigInfo>[] = [
    { title: "名称", dataIndex: "name", hideInSearch: true, width: 160, ellipsis: true },
    {
      title: "AppKey",
      dataIndex: "appKey",
      width: 240,
      render: (_, r) => (
        <SecretText
          value={r.appKey}
          visible={!!revealed[`${r.appKey}:appKey`]}
          onToggle={() => toggleReveal(`${r.appKey}:appKey`)}
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
      title: "创建时间",
      dataIndex: "createdAt",
      hideInSearch: true,
      width: 170,
      render: (_, r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"),
    },
    {
      title: "操作",
      valueType: "option",
      width: 200,
      render: (_, r) => [
        <a
          key="toggle"
          onClick={async () => {
            try {
              await licenseUpdateTenantConfig({ tenantKey: r.tenantKey! }, { disabled: !r.disabled });
              message.success(r.disabled ? "已启用" : "已停用（客户端面立即拒绝）");
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
          title="硬删除：app_key 立即失效且可被重新注册；已发的 License 不受影响。确定？"
          onConfirm={async () => {
            try {
              await licenseDeleteTenantConfig({ tenantKey: r.tenantKey! });
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
      <ProTable<API.v1LicenseTenantConfigInfo>
        headerTitle="租户配置列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        scroll={{ x: 900 }}
        request={async () => {
          const resp = await licenseListTenantConfigs();
          return { data: resp.configs ?? [], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="创建租户配置"
            trigger={<Button type="primary">创建租户配置</Button>}
            onFinish={async (vals) => {
              try {
                const resp = await licenseCreateTenantConfig({ name: vals.name });
                message.success("已创建，AppKey 见列表");
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
          </ModalForm>,
        ]}
      />
      <Space style={{ marginTop: 8, color: "#888" }}>
        配置行是接入方（业务系统）身份：数据面调用（激活 / 停用 / 试用启动）经 portal
        入口注入可信 x-tenant-key（④ 窗口关闭后 ak/sk 凭据已废弃，轮换接口已停用）；
        终端用户的 License Key 在「密钥管理」页维护。
      </Space>
    </PageContainer>
  );
}
