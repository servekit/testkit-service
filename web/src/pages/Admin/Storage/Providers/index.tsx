/**
 * Admin storage providers — editable: create (credentials), disable/enable,
 * delete (guarded while buckets are bound). The live registry rebuilds
 * downstream immediately.
 */
import {
  ModalForm,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Tag } from "antd";
import { useRef } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  adminCreateProvider,
  adminDeleteProvider,
  adminListProviders,
  adminUpdateProvider,
} from "@/services/testkit/testkitService";
import { VENDOR_VALUE_ENUM } from "@/components/storagetags";

export default function AdminProvidersPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();

  const columns: ProColumns<API.v1ProviderInfo>[] = [
    { title: "名称", dataIndex: "name" },
    { title: "厂商", dataIndex: "vendor", valueType: "select", valueEnum: VENDOR_VALUE_ENUM },
    { title: "Endpoint", dataIndex: "endpoint", search: false },
    { title: "Region", dataIndex: "region", search: false },
    {
      title: "STS",
      dataIndex: "stsEnabled",
      search: false,
      width: 70,
      render: (_, r) => (r.stsEnabled ? <Tag color="green">✓</Tag> : <Tag>—</Tag>),
    },
    { title: "桶数", dataIndex: "bucketCount", search: false, width: 70 },
    {
      title: "状态",
      dataIndex: "disabled",
      search: false,
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
              await adminUpdateProvider({ name: r.name, body: { disabled: !r.disabled } } as never);
              message.success(r.disabled ? "已启用" : "已停用（存量对象仍可读，新上传拒绝）");
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
          title="仍绑定桶时会被拒绝，确定删除？"
          onConfirm={async () => {
            try {
              await adminDeleteProvider({ name: r.name } as never);
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
      <ProTable<API.v1ProviderInfo>
        headerTitle="服务商列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="name"
        search={false}
        pagination={false}
        request={async () => {
          const resp = await adminListProviders();
          return { data: resp.providers ?? [], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="新建服务商"
            width={560}
            trigger={<Button type="primary">新建服务商</Button>}
            onFinish={async (vals) => {
              try {
                await adminCreateProvider({
                  name: vals.name,
                  vendor: vals.vendor,
                  endpoint: vals.endpoint ?? "",
                  region: vals.region ?? "",
                  accessKey: vals.accessKey,
                  secretKey: vals.secretKey,
                  roleArn: vals.roleArn ?? "",
                  domainId: vals.domainId ?? "",
                } as never);
                message.success("已创建（立即生效，无需重启）");
                reload();
                return true;
              } catch (err) {
                const e = err as { data?: { message?: string } };
                message.error(e?.data?.message ?? "创建失败");
                return false;
              }
            }}
          >
            <ProFormText name="name" label="名称" rules={[{ required: true }]} placeholder="如 aliyun-main" />
            <ProFormSelect name="vendor" label="厂商" valueEnum={VENDOR_VALUE_ENUM} rules={[{ required: true }]} />
            <ProFormText name="endpoint" label="Endpoint（可空）" />
            <ProFormText name="region" label="Region" />
            <ProFormText name="accessKey" label="AccessKey" rules={[{ required: true }]} />
            <ProFormText name="secretKey" label="SecretKey" rules={[{ required: true }]} />
            <ProFormDependency name={["vendor"]}>
              {({ vendor }) =>
                vendor === "VENDOR_HUAWEI_OBS" ? (
                  <ProFormText name="domainId" label="华为 DomainID" rules={[{ required: true }]} />
                ) : (
                  <ProFormText name="roleArn" label="RoleARN（启用 STS，可空）" />
                )
              }
            </ProFormDependency>
          </ModalForm>,
        ]}
      />
      <div style={{ marginTop: 8, color: "#888" }}>
        变更立即生效（注册表热更新）；改绑凭据可删除重建——桶绑定会拦截删除以保护存量对象。
      </div>
    </PageContainer>
  );
}
