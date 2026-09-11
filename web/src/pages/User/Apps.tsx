/**
 * 用户服务 · 租户注册表（④ 终态）。每行一个租户 = 一套独立的用户目录
 * （同名 username 可在不同租户各注册一次）。应用级 ak/sk 已随 ④ 窗口
 * 关闭退役：租户身份 = 可信 x-tenant-key（portal 入口注入），租户自身
 * 的凭据是 portal 的 ak/sk（在「租户管理」区轮换），本页不再有密钥列。
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
  userCreateApp,
  userDeleteApp,
  userListApps,
  userUpdateApp,
} from "@/services/testkit/testkitService";

export default function UserAppsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  // 掩码开关按 "tenantKey:字段" 记忆（tenant_key 是调用方要配置的标识）
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggleReveal = (key: string) =>
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));

  const columns: ProColumns<API.v1UserAppInfo>[] = [
    { title: "名称", dataIndex: "name", hideInSearch: true, width: 160, ellipsis: true },
    {
      title: "TenantKey",
      dataIndex: "tenantKey",
      width: 220,
      render: (_, r) => (
        <SecretText
          value={r.tenantKey}
          visible={!!revealed[`${r.tenantKey}:tenantKey`]}
          onToggle={() => toggleReveal(`${r.tenantKey}:tenantKey`)}
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
              await userUpdateApp({ tenantKey: r.tenantKey! }, { disabled: !r.disabled });
              message.success(r.disabled ? "已启用" : "已停用（该应用的登录/注册立即拒绝）");
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
          title="仍有用户归属该租户时会拒绝删除。确定删除？"
          onConfirm={async () => {
            try {
              await userDeleteApp({ tenantKey: r.tenantKey! });
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
      <ProTable<API.v1UserAppInfo>
        headerTitle="应用列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="tenantKey"
        search={false}
        pagination={false}
        scroll={{ x: 900 }}
        request={async () => {
          const resp = await userListApps();
          return { data: resp.apps ?? [], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="创建应用"
            trigger={<Button type="primary">创建应用</Button>}
            onFinish={async (vals) => {
              try {
                const resp = await userCreateApp({ name: vals.name });
                message.success("已创建，TenantKey 见列表");
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
        每个租户是一套独立的用户目录：同名 username 可在不同租户各注册一次。租户身份由可信
        x-tenant-key（portal 入口注入）承载，应用级 ak/sk 已退役；租户自身的登录凭据是 portal
        的 ak/sk，在「租户管理」区轮换。停用后该租户的登录/注册立即失效。
      </Space>
    </PageContainer>
  );
}
