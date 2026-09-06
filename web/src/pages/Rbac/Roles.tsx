import {
  ModalForm,
  PageContainer,
  ProTable,
  ProFormText,
  ProFormTextArea,
  ProFormSelect,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { spinReload } from "@/components/TableOptions";
import { App, Button, Popconfirm, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRef, useState } from "react";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
} from "@/services/testkit/testkitService";
import { useCursorTable } from "@/components/CursorPager";

/**
 * RBAC role management: list, create, update, delete. Roles reference
 * permissions (multi-select sourced from listPermissions). Cursor list →
 * useCursorTable surfaces the cursor API as progressive prev/next paging.
 */
export default function RolesPage() {
  const { message } = App.useApp();
  const table = useCursorTable(async ({ cursor, pageSize }) => {
    const resp = await listRoles({ pageSize, cursor: cursor || undefined });
    return { items: resp.roles, nextCursor: resp.nextCursor };
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<API.Role>();

  const columns: ProColumns<API.Role>[] = [
    { title: "ID", dataIndex: "id", width: 100 },
    { title: "名称", dataIndex: "name" },
    { title: "描述", dataIndex: "description" },
    {
      title: "内置",
      dataIndex: "isBuiltin",
      width: 90,
      render: (_, r) =>
        r.isBuiltin ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>,
    },
    {
      title: "权限数",
      dataIndex: "permissions",
      width: 90,
      render: (_, r) => r.permissions?.length ?? 0,
    },
    {
      title: "操作",
      valueType: "option",
      width: 140,
      render: (_, r) => [
        <a
          key="edit"
          onClick={() => {
            setEditing(r);
          }}
        >
          编辑
        </a>,
        <Popconfirm
          key="del"
          title="删除该角色？"
          disabled={r.isBuiltin}
          onConfirm={async () => {
            await deleteRole({ roleId: r.id ?? "" });
            message.success("已删除");
            table.actionRef.current?.reload();
          }}
        >
          <a style={{ color: r.isBuiltin ? undefined : "red" }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  // Shared permission options loader for create/edit forms.
  const permissionOptions = async () => {
    const resp = await listPermissions({ pageSize: 200 });
    return (resp.permissions ?? [])
      .filter((p): p is API.Permission & { id: string } => !!p.id)
      .map((p) => ({
        label: `${p.resource}:${p.action}`,
        value: p.id,
      }));
  };

  const handleFinish = async (vals: {
    name: string;
    description?: string;
    permissionIds?: string[];
  }) => {
    if (editing) {
      await updateRole(
        { roleId: editing.id ?? "" },
        {
          name: vals.name,
          description: vals.description,
          permissionIds: vals.permissionIds,
        },
      );
      setEditing(undefined);
    } else {
      await createRole(vals);
      setCreateOpen(false);
    }
    message.success("已保存");
    table.actionRef.current?.reload();
    return true;
  };

  // Initial values for the edit form (name/description + permission ids).
  const editInitial = editing
    ? {
        name: editing.name,
        description: editing.description,
        permissionIds: editing.permissions?.map((p) => p.id).filter(Boolean),
      }
    : undefined;

  return (
    <PageContainer>
      <ProTable<API.Role>
        actionRef={table.actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        headerTitle="角色"
        options={spinReload}
        request={table.request}
        footer={() => table.pager}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建角色
          </Button>,
        ]}
      />

      <ModalForm
        title="新建角色"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleFinish}
      >
        <RoleFields permissionOptions={permissionOptions} />
      </ModalForm>

      <ModalForm
        title="编辑角色"
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        initialValues={editInitial}
        onFinish={handleFinish}
      >
        <RoleFields permissionOptions={permissionOptions} />
      </ModalForm>
    </PageContainer>
  );
}

function RoleFields({
  permissionOptions,
}: {
  permissionOptions: () => Promise<{ label: string; value: string }[]>;
}) {
  return (
    <>
      <ProFormText
        name="name"
        label="名称"
        rules={[{ required: true, message: "请输入名称" }]}
      />
      <ProFormTextArea name="description" label="描述" />
      <ProFormSelect
        name="permissionIds"
        label="权限"
        mode="multiple"
        request={permissionOptions}
        fieldProps={{ showSearch: true, optionFilterProp: "label" }}
      />
    </>
  );
}
