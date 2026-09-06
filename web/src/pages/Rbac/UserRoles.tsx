import {
  ModalForm,
  PageContainer,
  ProTable,
  ProFormText,
  ProFormSelect,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRef, useState } from "react";
import {
  assignRole,
  listRoles,
  listUserRoles,
  revokeRole,
} from "@/services/testkit/testkitService";

/**
 * Per-user role assignment. Operator enters a target user_id, views the user's
 * effective roles (direct + via groups), and assigns / revokes roles.
 * target user_id is kept in the request (admin "act on whom" pattern).
 */
export default function UserRolesPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [userId, setUserId] = useState<string>();
  const [assignOpen, setAssignOpen] = useState(false);

  const columns: ProColumns<API.UserRole>[] = [
    { title: "角色 ID", dataIndex: "roleId", width: 120, copyable: true },
    { title: "角色名", dataIndex: "roleName" },
    {
      title: "来源",
      dataIndex: "source",
      width: 160,
      render: (_, r) =>
        r.source === "direct" ? (
          <Tag color="blue">直接</Tag>
        ) : (
          <Tag>{r.source}</Tag>
        ),
    },
    { title: "授权时间", dataIndex: "createdAt", valueType: "dateTime", width: 180 },
    {
      title: "操作",
      valueType: "option",
      width: 100,
      render: (_, r) => [
        <Popconfirm
          key="revoke"
          title="撤销该角色？"
          onConfirm={async () => {
            await revokeRole({
              userId: userId ?? "",
              roleId: r.roleId ?? "",
            });
            message.success("已撤销");
            actionRef.current?.reload();
          }}
        >
          <a style={{ color: "red" }}>撤销</a>
        </Popconfirm>,
      ],
    },
  ];

  const roleOptions = async () => {
    const resp = await listRoles({ pageSize: 200 });
    return (resp.roles ?? []).map((rl) => ({
      label: rl.name,
      value: rl.id,
    }));
  };

  return (
    <PageContainer>
      <ProTable<API.UserRole>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={{ labelWidth: "auto" }}
        pagination={false}
        headerTitle="用户角色"
        request={async (params) => {
          const uid = (params.userId as string) ?? "";
          setUserId(uid);
          if (!uid) return { data: [], success: true };
          const resp = await listUserRoles({ userId: uid });
          return { data: resp.roles ?? [], success: true };
        }}
        toolBarRender={() => [
          <Button
            key="assign"
            type="primary"
            icon={<PlusOutlined />}
            disabled={!userId}
            onClick={() => setAssignOpen(true)}
          >
            分配角色
          </Button>,
        ]}
      />

      <ModalForm
        title={`分配角色：${userId ?? ""}`}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onFinish={async (vals) => {
          await assignRole({ userId: userId ?? "" }, { roleId: vals.roleId });
          message.success("已分配");
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="roleId"
          label="角色"
          request={roleOptions}
          rules={[{ required: true, message: "请选择角色" }]}
        />
        <ProFormText
          name="userId"
          label="用户 ID"
          readonly
          initialValue={userId}
        />
      </ModalForm>
    </PageContainer>
  );
}
