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
import { App, Button, Drawer, Popconfirm } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRef, useState } from "react";
import {
  addGroupMember,
  createGroup,
  listGroupMembers,
  listGroups,
  removeGroupMember,
} from "@/services/testkit/testkitService";
import { cursorList } from "@/utils/cursorList";

const MEMBER_ROLE_OPTIONS = [
  { value: "owner", label: "负责人" },
  { value: "admin", label: "管理员" },
  { value: "member", label: "成员" },
];

/**
 * RBAC group management: list, create, and a per-group members drawer
 * (list / add / remove members). Roles are CRUD-only this phase (design §3.5).
 */
export default function GroupsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [membersGroup, setMembersGroup] = useState<API.Group>();
  const memberRef = useRef<ActionType>(undefined);

  const columns: ProColumns<API.Group>[] = [
    { title: "ID", dataIndex: "id", width: 100 },
    { title: "名称", dataIndex: "name" },
    { title: "描述", dataIndex: "description" },
    { title: "父组 ID", dataIndex: "parentId", search: false, width: 120 },
    { title: "状态", dataIndex: "status", width: 100 },
    {
      title: "成员数",
      dataIndex: "memberCount",
      width: 90,
      search: false,
    },
    {
      title: "操作",
      valueType: "option",
      width: 120,
      render: (_, r) => [
        <a
          key="members"
          onClick={() => {
            setMembersGroup(r);
            setTimeout(() => memberRef.current?.reload(), 0);
          }}
        >
          成员
        </a>,
      ],
    },
  ];

  const memberColumns: ProColumns<API.GroupMember>[] = [
    { title: "用户 ID", dataIndex: "userId", copyable: true },
    { title: "昵称", dataIndex: "nickname" },
    { title: "角色", dataIndex: "role", width: 100 },
    { title: "加入时间", dataIndex: "createdAt", width: 180 },
    {
      title: "操作",
      valueType: "option",
      width: 90,
      render: (_, r) => [
        <Popconfirm
          key="remove"
          title="移除该成员？"
          onConfirm={async () => {
            await removeGroupMember({
              groupId: membersGroup?.id ?? "",
              userId: r.userId ?? "",
            });
            message.success("已移除");
            memberRef.current?.reload();
          }}
        >
          <a style={{ color: "red" }}>移除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.Group>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        headerTitle="用户组"
        request={() =>
          cursorList(async (n) => {
            const resp = await listGroups({ pageSize: n });
            return { items: resp.groups };
          })
        }
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建用户组
          </Button>,
        ]}
      />

      <ModalForm
        title="新建用户组"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={async (vals) => {
          await createGroup(vals);
          message.success("已创建");
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormText
          name="name"
          label="名称"
          rules={[{ required: true, message: "请输入名称" }]}
        />
        <ProFormTextArea name="description" label="描述" />
        <ProFormText name="parentId" label="父组 ID（可选）" />
      </ModalForm>

      <Drawer
        title={`成员管理：${membersGroup?.name ?? ""}`}
        open={!!membersGroup}
        onClose={() => setMembersGroup(undefined)}
        width={720}
        destroyOnClose
      >
        <ProTable<API.GroupMember>
          actionRef={memberRef}
          columns={memberColumns}
          rowKey="userId"
          search={false}
          pagination={false}
          options={false}
          request={async () => {
            if (!membersGroup?.id) return { data: [], success: true };
            const resp = await listGroupMembers({
              groupId: membersGroup.id,
              pageSize: 100,
            });
            return { data: resp.members ?? [], success: true };
          }}
          toolBarRender={() => [
            <ModalForm
              key="add"
              title="添加成员"
              trigger={
                <Button type="primary" icon={<PlusOutlined />}>
                  添加成员
                </Button>
              }
              onFinish={async (vals) => {
                await addGroupMember(
                  { groupId: membersGroup?.id ?? "" },
                  { userId: vals.userId, role: vals.role },
                );
                message.success("已添加");
                memberRef.current?.reload();
                return true;
              }}
            >
              <ProFormText
                name="userId"
                label="用户 ID"
                rules={[{ required: true, message: "请输入用户 ID" }]}
              />
              <ProFormSelect
                name="role"
                label="角色"
                options={MEMBER_ROLE_OPTIONS}
                rules={[{ required: true, message: "请选择角色" }]}
              />
            </ModalForm>,
          ]}
        />
      </Drawer>
    </PageContainer>
  );
}
