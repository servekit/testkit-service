/**
 * 用户服务 · 应用管理（租户注册表）。与其他平台的应用管理同一套交互：
 * ak（app_key）系统生成、sk（app_secret）可轮换、列表掩码可见。每个应用
 * 是一套独立的用户目录——同名 username 可在不同应用各注册一次；登录/
 * 注册/管理面的租户由可信调用方（BFF 的 ak/sk）决定，终端用户无感知。
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
  userRotateAppSecret,
  userUpdateApp,
} from "@/services/testkit/testkitService";

export default function UserAppsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  // 掩码开关按 "tenantKey:字段" 记忆；创建/轮换后自动点亮对应行的 AppSecret
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggleReveal = (key: string) =>
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  const reveal = (tenantKey: string | undefined) => {
    if (tenantKey) setRevealed((prev) => ({ ...prev, [`${tenantKey}:appSecret`]: true }));
  };

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
      title: "AppSecret",
      dataIndex: "appSecret",
      width: 400,
      render: (_, r) => (
        <SecretText
          value={r.appSecret}
          visible={!!revealed[`${r.tenantKey}:appSecret`]}
          onToggle={() => toggleReveal(`${r.tenantKey}:appSecret`)}
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
          key="rotate"
          onClick={async () => {
            try {
              await userRotateAppSecret({ tenantKey: r.tenantKey! }, {} as never);
              message.success("已轮换，新 AppSecret 见列表");
              reveal(r.tenantKey);
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
        scroll={{ x: 1280 }}
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
                message.success("已创建，TenantKey/AppSecret 见列表");
                reveal(resp.app?.tenantKey);
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
        每个应用是一套独立的用户目录（租户）：同名 username 可在不同应用各注册一次；登录、注册、
        用户运营等管理面按调用方应用的 ak/sk 划定租户边界。停用后该应用的登录/注册立即失效。
      </Space>
    </PageContainer>
  );
}
