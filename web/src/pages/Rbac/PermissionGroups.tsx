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
  createPermissionGroup,
  deletePermissionGroup,
  listPermissionGroups,
  listPermissions,
  updatePermissionGroup,
} from "@/services/testkit/testkitService";
import { useCursorTable } from "@/components/CursorPager";

interface PermGroupForm {
  name: string;
  description?: string;
  permissionIds?: string[];
}

/**
 * RBAC permission-group CRUD. A group bundles permissions for easier assignment
 * to roles. Permissions multi-select sourced from listPermissions.
 */
export default function PermissionGroupsPage() {
  const { message } = App.useApp();
  const table = useCursorTable(async ({ cursor, pageSize }) => {
    const resp = await listPermissionGroups({ pageSize, cursor: cursor || undefined });
    return { items: resp.groups, nextCursor: resp.nextCursor };
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<API.PermissionGroup>();

  const columns: ProColumns<API.PermissionGroup>[] = [
    { title: "ID", dataIndex: "id", width: 100 },
    { title: "名称", dataIndex: "name" },
    { title: "描述", dataIndex: "description" },
    {
      title: "权限数",
      width: 90,
      render: (_, r) => r.permissions?.length ?? 0,
    },
    {
      title: "内置",
      dataIndex: "isBuiltin",
      width: 90,
      render: (_, r) =>
        r.isBuiltin ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>,
    },
    {
      title: "操作",
      valueType: "option",
      width: 140,
      render: (_, r) => [
        <a key="edit" onClick={() => setEditing(r)}>
          编辑
        </a>,
        <Popconfirm
          key="del"
          title="删除该权限组？"
          disabled={r.isBuiltin}
          onConfirm={async () => {
            await deletePermissionGroup({
              permissionGroupId: r.id ?? "",
            });
            message.success("已删除");
            table.actionRef.current?.reload();
          }}
        >
          <a style={{ color: r.isBuiltin ? undefined : "red" }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  const permissionOptions = async () => {
    const resp = await listPermissions({ pageSize: 200 });
    return (resp.permissions ?? [])
      .filter((p): p is API.Permission & { id: string } => !!p.id)
      .map((p) => ({
        label: `${p.resource}:${p.action}`,
        value: p.id,
      }));
  };

  const onFinish = async (vals: PermGroupForm) => {
    if (editing) {
      await updatePermissionGroup(
        { permissionGroupId: editing.id ?? "" },
        {
          name: vals.name,
          description: vals.description,
          permissionIds: vals.permissionIds,
        },
      );
      setEditing(undefined);
    } else {
      await createPermissionGroup(vals);
      setCreateOpen(false);
    }
    message.success("已保存");
    table.actionRef.current?.reload();
    return true;
  };

  return (
    <PageContainer>
      <ProTable<API.PermissionGroup>
        actionRef={table.actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        headerTitle="权限组"
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
            新建权限组
          </Button>,
        ]}
      />

      <ModalForm
        title="新建权限组"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={onFinish}
      >
        <PermGroupFields permissionOptions={permissionOptions} />
      </ModalForm>

      <ModalForm
        title="编辑权限组"
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        initialValues={
          editing
            ? {
                name: editing.name,
                description: editing.description,
                permissionIds: editing.permissions
                  ?.map((p) => p.id)
                  .filter(Boolean),
              }
            : undefined
        }
        onFinish={onFinish}
      >
        <PermGroupFields permissionOptions={permissionOptions} />
      </ModalForm>
    </PageContainer>
  );
}

function PermGroupFields({
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
