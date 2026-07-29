import {
  ModalForm,
  PageContainer,
  ProTable,
  ProFormSelect,
  ProFormText,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRef, useState } from "react";
import {
  bindIdentity,
  listIdentities,
  unbindIdentity,
} from "@/services/testkit/testkitService";
import { PROVIDER_VALUE_ENUM } from "@/components/usertags";

/**
 * Self-service identity (login-method) management.
 * List the caller's bound identities, bind a new email/phone, unbind by id.
 * user_id is injected from ctx on the backend — not present in the request.
 */
export default function IdentityPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [bindOpen, setBindOpen] = useState(false);

  const columns: ProColumns<API.Identity>[] = [
    {
      title: "ID",
      dataIndex: "id",
      width: 200,
      copyable: true,
    },
    {
      title: "登录方式",
      dataIndex: "provider",
      valueType: "select",
      valueEnum: PROVIDER_VALUE_ENUM,
      width: 140,
    },
    { title: "标识", dataIndex: "providerUid", copyable: true },
    {
      title: "已验证",
      dataIndex: "verified",
      width: 100,
      render: (_, r) =>
        r.verified ? <Tag color="green">已验证</Tag> : <Tag>未验证</Tag>,
    },
    {
      title: "绑定时间",
      dataIndex: "createdAt",
      width: 180,
    },
    {
      title: "操作",
      valueType: "option",
      width: 100,
      render: (_, r) => [
        <Popconfirm
          key="unbind"
          title="解绑该登录方式？"
          onConfirm={async () => {
            await unbindIdentity({ identityId: r.id ?? "", code: "" });
            message.success("已解绑");
            actionRef.current?.reload();
          }}
        >
          <Button type="link" danger>
            解绑
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.Identity>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        headerTitle="已绑定的登录方式"
        request={async () => {
          const resp = await listIdentities();
          return { data: resp.identities ?? [], success: true };
        }}
        toolBarRender={() => [
          <Button
            key="bind"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setBindOpen(true)}
          >
            绑定
          </Button>,
        ]}
      />
      <ModalForm
        title="绑定登录方式"
        open={bindOpen}
        onOpenChange={setBindOpen}
        onFinish={async (vals) => {
          await bindIdentity({
            provider: vals.provider,
            email: vals.email,
            regionCode: vals.regionCode,
            phone: vals.phone,
            code: vals.code,
          });
          message.success("已发送绑定请求，请按验证码完成验证");
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="provider"
          label="方式"
          rules={[{ required: true, message: "请选择方式" }]}
          options={[
            { value: "IDENTITY_PROVIDER_EMAIL", label: "邮箱" },
            { value: "IDENTITY_PROVIDER_PHONE", label: "手机" },
          ]}
        />
        <ProFormText name="email" label="邮箱" placeholder="绑定邮箱时填写" />
        <ProFormText
          name="regionCode"
          label="国家码"
          placeholder="CN"
          fieldProps={{ maxLength: 2 }}
        />
        <ProFormText name="phone" label="手机号" placeholder="绑定手机时填写" />
        <ProFormText
          name="code"
          label="验证码"
          rules={[{ required: true, message: "请输入验证码" }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
