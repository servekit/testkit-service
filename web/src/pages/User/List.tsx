import {
  ModalForm,
  PageContainer,
  ProTable,
  ProFormText,
  ProFormSelect,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { listPagination } from "@/utils/pagination";
import { useRegionOptions } from "@/hooks/useRegionOptions";
import { spinReload } from "@/components/TableOptions";
import dayjs from "dayjs";
import { App, Button, Popconfirm } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import {
  createUser,
  disableUser,
  listUsersPaged,
  userListApps,
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
 * access gated to canPlatform at the route level.
 */
export default function UserListPage() {
  const regionOptions = useRegionOptions();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  // 租户选项（平台运营视角可跨租户筛选；普通租户视角服务端会忽略并锁定自己）
  const [apps, setApps] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    void userListApps().then((resp) => {
      setApps(
        (resp.apps ?? []).map((a) => ({
          value: a.tenantKey ?? "",
          label: `${a.name}（${a.tenantKey}）`,
        })),
      );
    });
  }, []);

  const columns: ProColumns<API.User>[] = [
    {
      title: "租户",
      dataIndex: "tenantKey",
      valueType: "select",
      fieldProps: { options: apps, allowClear: true },
      width: 140,
      render: (_, r) => (r.tenantKey ? <code>{r.tenantKey}</code> : "-"),
    },
    { title: "ID", dataIndex: "id", width: 180 },
    { title: "用户名", dataIndex: "username" },
    { title: "昵称", dataIndex: "nickname" },
    { title: "邮箱", dataIndex: "email" },
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
    {
      title: "最后登录",
      dataIndex: "lastLoginAt",
      search: false,
      width: 180,
      // proto zero-time (1970) means the user never logged in.
      render: (_, r) =>
        r.lastLoginAt && !r.lastLoginAt.startsWith("1970")
          ? dayjs(r.lastLoginAt).format("YYYY-MM-DD HH:mm:ss")
          : "-",
    },
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
        pagination={listPagination}
        options={spinReload}
        request={async (params) => {
          const {
            current = 1,
            pageSize = 20,
            status,
            nickname,
            username,
            email,
            userType,
            tenantKey,
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
            tenantKey: (tenantKey as string) || undefined,
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
          name="tenantKey"
          label="目标租户"
          rules={[{ required: true, message: "请选择租户" }]}
          options={apps}
        />
        <ProFormSelect
          name="userType"
          label="账号类型"
          rules={[{ required: true, message: "请选择类型" }]}
          options={[
            { value: "USER_TYPE_END_USER", label: "终端用户" },
            { value: "USER_TYPE_PLATFORM", label: "平台用户" },
            { value: "USER_TYPE_TENANT_ADMIN", label: "租户管理员" },
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
        <div style={{ display: "flex", gap: 8 }}>
          <ProFormSelect
            name="dialCode"
            label="区号"
            initialValue="+86"
            fieldProps={{
              showSearch: true,
              optionFilterProp: "label",
              style: { width: 160 },
            }}
            options={regionOptions}
          />
          <ProFormText
            name="phone"
            label="手机号"
            placeholder="本地号码，无 +"
            fieldProps={{ style: { flex: 1 } }}
          />
        </div>
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
        <ProFormSelect
          name="timezone"
          label="时区"
          showSearch
          initialValue="Asia/Shanghai"
          options={[
            { value: "Asia/Shanghai", label: "Asia/Shanghai" },
            { value: "UTC", label: "UTC" },
            { value: "Asia/Tokyo", label: "Asia/Tokyo" },
            { value: "Europe/London", label: "Europe/London" },
            { value: "America/New_York", label: "America/New_York" },
          ]}
        />
        <ProFormSelect
          name="locale"
          label="语言"
          initialValue="zh-CN"
          options={[
            { value: "zh-CN", label: "简体中文 (zh-CN)" },
            { value: "en-US", label: "English (en-US)" },
          ]}
        />
      </ModalForm>
    </PageContainer>
  );
}
