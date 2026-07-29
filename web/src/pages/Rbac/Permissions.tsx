import {
  ModalForm,
  PageContainer,
  ProTable,
  ProFormText,
  ProFormTextArea,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRef, useState } from "react";
import {
  createPermission,
  deletePermission,
  listPermissions,
  updatePermission,
} from "@/services/testkit/testkitService";
import { cursorList } from "@/utils/cursorList";

interface PermForm {
  resource: string;
  action: string;
  description?: string;
}

/**
 * RBAC permission CRUD. Permissions are resource:action pairs referenced by
 * roles and permission groups.
 */
export default function PermissionsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<API.Permission>();

  const columns: ProColumns<API.Permission>[] = [
    { title: "ID", dataIndex: "id", width: 100 },
    { title: "资源", dataIndex: "resource" },
    { title: "动作", dataIndex: "action", width: 120 },
    { title: "描述", dataIndex: "description" },
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
          title="删除该权限？"
          disabled={r.isBuiltin}
          onConfirm={async () => {
            await deletePermission({ permissionId: r.id ?? "" });
            message.success("已删除");
            actionRef.current?.reload();
          }}
        >
          <a style={{ color: r.isBuiltin ? undefined : "red" }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  const onFinish = async (vals: PermForm) => {
    if (editing) {
      await updatePermission(
        { permissionId: editing.id ?? "" },
        {
          resource: vals.resource,
          action: vals.action,
          description: vals.description,
        },
      );
      setEditing(undefined);
    } else {
      await createPermission(vals);
      setCreateOpen(false);
    }
    message.success("已保存");
    actionRef.current?.reload();
    return true;
  };

  return (
    <PageContainer>
      <ProTable<API.Permission>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        headerTitle="权限"
        request={() =>
          cursorList(async (n) => {
            const resp = await listPermissions({ pageSize: n });
            return { items: resp.permissions };
          })
        }
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建权限
          </Button>,
        ]}
      />

      <ModalForm
        title="新建权限"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={onFinish}
      >
        <PermFields />
      </ModalForm>

      <ModalForm
        title="编辑权限"
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        initialValues={
          editing
            ? {
                resource: editing.resource,
                action: editing.action,
                description: editing.description,
              }
            : undefined
        }
        onFinish={onFinish}
      >
        <PermFields />
      </ModalForm>
    </PageContainer>
  );
}

function PermFields() {
  return (
    <>
      <ProFormText
        name="resource"
        label="资源"
        rules={[{ required: true, message: "请输入资源" }]}
      />
      <ProFormText
        name="action"
        label="动作"
        rules={[{ required: true, message: "请输入动作" }]}
      />
      <ProFormTextArea name="description" label="描述" />
    </>
  );
}
