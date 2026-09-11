/**
 * 存储平台 · 租户配置（④T6 更名，原「应用管理」）。每个租户一行配置。④ 窗
 * 口关闭后配置行不再携带凭据（app_secret 列已删）：数据面调用经 portal 入口
 * 注入可信 x-tenant-key，而非 ak/sk。存储特有的两列：Key Prefix（对象命名
 * 空间 = 隔离与去重域，全局唯一且不可改）与绑定桶。创建为幂等 ensure：租
 * 户已有配置行时直接返回该行。
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
  adminDeleteTenantConfig,
  adminEnsureTenantConfig,
  adminListTenantConfigs,
  adminUpdateTenantConfig,
} from "@/services/testkit/testkitService";

export default function AdminStorageAppsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  // 掩码开关按 "appKey:字段" 记忆（AppKey 是行的机器标识）
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggleReveal = (key: string) =>
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));

  const columns: ProColumns<API.v1StorageTenantConfigInfo>[] = [
    { title: "名称", dataIndex: "name", hideInSearch: true, width: 140, ellipsis: true },
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
      title: "Key Prefix",
      dataIndex: "keyPrefix",
      width: 160,
      render: (_, r) => <Tag color="blue">{r.keyPrefix}</Tag>,
    },
    {
      title: "绑定桶",
      dataIndex: "bucketId",
      hideInSearch: true,
      width: 100,
      render: (_, r) =>
        Number(r.bucketId) === 0 ? <Tag>默认桶</Tag> : <Tag color="geekblue">#{r.bucketId}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "disabled",
      hideInSearch: true,
      width: 80,
      render: (_, r) => (r.disabled ? <Tag color="red">停用</Tag> : <Tag color="green">启用</Tag>),
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
              await adminUpdateTenantConfig({ tenantKey: r.tenantKey! }, { disabled: !r.disabled });
              message.success(r.disabled ? "已启用" : "已停用（数据面立即拒绝）");
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
          title="删除后数据面立即拒绝；存量对象仍可读。确定？"
          onConfirm={async () => {
            try {
              await adminDeleteTenantConfig({ tenantKey: r.tenantKey! });
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
      <ProTable<API.v1StorageTenantConfigInfo>
        headerTitle="应用列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        scroll={{ x: 950 }}
        request={async () => {
          const resp = await adminListTenantConfigs();
          return { data: resp.configs ?? [], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="创建租户配置"
            width={560}
            trigger={<Button type="primary">创建租户配置</Button>}
            onFinish={async (vals) => {
              try {
                const resp = await adminEnsureTenantConfig({
                  name: vals.name,
                  keyPrefix: vals.keyPrefix,
                  bucketId: String(Number(vals.bucketId ?? 0)),
                });
                message.success("已就绪，AppKey 见列表");
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
            <ProFormText
              name="keyPrefix"
              label="Key Prefix（对象命名空间，全局唯一且不可改，必须以 / 结尾）"
              rules={[
                { required: true },
                {
                  pattern: /^[a-z][a-z0-9-]{1,62}\/$/,
                  message: "格式：小写字母开头，字母/数字/短横线，以 / 结尾",
                },
              ]}
              placeholder="如 my-app/"
            />
            <ProFormDigit
              name="bucketId"
              label="绑定桶 ID（0 = 默认桶；PUBLIC 上传始终落公共桶）"
              min={0}
              fieldProps={{ precision: 0 }}
              placeholder="0"
            />
          </ModalForm>,
        ]}
      />
      <Space style={{ marginTop: 8, color: "#888" }}>
        每个应用的对象都写在自己的 key_prefix 下，去重域 = prefix（跨应用同内容各存一份）；数据面调用经
        portal 入口注入可信 x-tenant-key（④ 窗口关闭后 ak/sk 凭据已废弃，轮换接口已停用）。
      </Space>
    </PageContainer>
  );
}
