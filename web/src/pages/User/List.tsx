import {
  ModalForm,
  PageContainer,
  ProTable,
  ProFormText,
  ProFormSelect,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRef, useState } from "react";
import {
  createUser,
  disableUser,
  listUsersPaged,
} from "@/services/testkit/testkitService";
import {
  GENDER_VALUE_ENUM,
  PROVIDER_VALUE_ENUM,
  USER_STATUS_VALUE_ENUM,
  USER_TYPE_VALUE_ENUM,
  UserStatusTag,
  UserTypeTag,
} from "@/components/usertags";

const DISABLED = "USER_STATUS_DISABLED";

/**
 * Internal user-admin list. Offset pagination (listUsersPaged), status/type
 * tags, enable/disable (disableUser), and create-user (createUser).
 * access gated to canInternal at the route level.
 */
export default function UserListPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const columns: ProColumns<API.User>[] = [
    { title: "ID", dataIndex: "id", width: 180, copyable: true },
    { title: "用户名", dataIndex: "username" },
    { title: "昵称", dataIndex: "nickname" },
    { title: "邮箱", dataIndex: "email", copyable: true },
    {
      title: "类型",
      dataIndex: "userType",
      valueType: "select",
      valueEnum: USER_TYPE_VALUE_ENUM,
      width: 90,
      render: (_, r) => <UserTypeTag userType={r.userType} />,
    },
    {
      title: "状态",
      dataIndex: "status",
      valueType: "select",
      valueEnum: USER_STATUS_VALUE_ENUM,
      width: 90,
      render: (_, r) => <UserStatusTag status={r.status} />,
    },
    {
      title: "注册来源",
      dataIndex: "registerSource",
      search: false,
      valueEnum: PROVIDER_VALUE_ENUM,
    },
    { title: "最后登录", dataIndex: "lastLoginAt", search: false, width: 180 },
    {
      title: "操作",
      valueType: "option",
      width: 90,
      render: (_, r) => [
        <Popconfirm
          key="toggle"
          title={r.status === DISABLED ? "启用该用户？" : "禁用该用户？"}
          onConfirm={async () => {
            await disableUser(
              { userId: r.id ?? "" },
              { disable: r.status !== DISABLED, reason: "" },
            );
            message.success("已操作");
            actionRef.current?.reload();
          }}
        >
          <Button type="link" danger={r.status !== DISABLED}>
            {r.status === DISABLED ? "启用" : "禁用"}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.User>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={{ labelWidth: "auto" }}
        pagination={{ pageSize: 20 }}
        request={async (params) => {
          const {
            current = 1,
            pageSize = 20,
            status,
            nickname,
            username,
            email,
            userType,
          } = params;
          const resp = await listUsersPaged({
            page: current,
            pageSize,
            count: true,
            status: status as API.ListUsersPagedParams["status"],
            nickname,
            username,
            email,
            userType: userType as API.ListUsersPagedParams["userType"],
          });
          return {
            data: resp.users ?? [],
            total: Number(resp.total ?? 0),
            success: true,
          };
        }}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建用户
          </Button>,
        ]}
      />
      <ModalForm
        title="新建用户"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={async (vals) => {
          await createUser(vals);
          message.success("已创建");
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="userType"
          label="账号类型"
          rules={[{ required: true, message: "请选择类型" }]}
          options={[
            { value: "USER_TYPE_NORMAL", label: "外部" },
            { value: "USER_TYPE_INTERNAL", label: "内部" },
          ]}
        />
        <ProFormText
          name="username"
          label="用户名"
          rules={[{ required: true, message: "请输入用户名" }]}
        />
        <ProFormText name="nickname" label="昵称" />
        <ProFormText name="realName" label="真实姓名" />
        <ProFormText name="email" label="邮箱" />
        <ProFormText name="regionCode" label="国家码" placeholder="CN" />
        <ProFormText name="phone" label="手机号" />
        <ProFormText.Password
          name="password"
          label="初始密码"
          rules={[
            { required: true, message: "请输入初始密码" },
            { min: 8, message: "至少 8 位" },
          ]}
        />
        <ProFormSelect
          name="gender"
          label="性别"
          valueEnum={GENDER_VALUE_ENUM}
        />
      </ModalForm>
    </PageContainer>
  );
}
