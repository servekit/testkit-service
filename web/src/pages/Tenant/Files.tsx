/**
 * 存储服务 · 租户文件（tenant platform phase ④ Q11；⑤ 验收自 租户管理→文件管理 挪位）。
 *
 * 与消息资源页（后端全量返回、前端按 tenant_key 过滤）不同，文件管理面是
 * 服务端收敛的：请求经门注入 x-tenant-key，storage-service 按注入键把
 * AdminListFiles / AdminDeleteFile 收敛到本租户行（跨租户 file_id 一律答
 * 不存在——反枚举）。所以本页不做事后行过滤，后端返回什么就是本租户的。
 *
 * - TENANT_ADMIN：顶栏切换器（单绑定自动默认）→ 固定本租户。
 * - PLATFORM：切换器选中租户 = 下钻（同样收敛到该租户）；未选租户（跨视图）
 *   时本页给出提示——跨租户全量面在 存储管理 → 文件。
 *
 * 删除走 AdminDeleteFile：硬删除（不可恢复），二次确认；释放配额与对象
 * 引用计数都在服务端事务里完成。
 */
import {
  PageContainer,
  ProTable,
  type ProColumns,
} from "@ant-design/pro-components";
import { useCursorTable } from "@/components/CursorPager";
import { spinReload } from "@/components/TableOptions";
import { useTenantView } from "@/components/tenantScope";
import { Alert, App, Popconfirm, Tag } from "antd";
import {
  adminDeleteFile,
  adminListFiles,
} from "@/services/testkit/testkitService";
import {
  OWNER_TYPE_VALUE_ENUM,
  formatBytes,
} from "@/components/storagetags";

export default function TenantFilesPage() {
  const { message } = App.useApp();
  const view = useTenantView();

  // adminListFiles is cursor-based (pageToken): the console-wide
  // useCursorTable convention drives progressive paging. Scope comes from the
  // injected key server-side — no client-side row filtering here (see header).
  const table = useCursorTable<API.v1AdminFileInfo>(async (params) => {
    const resp = await adminListFiles({
      ownerType: params.ownerType as API.AdminListFilesParams["ownerType"],
      ownerId: params.ownerId as string | undefined,
      pathPrefix: params.pathPrefix as string | undefined,
      extension: params.extension as string | undefined,
      pageSize: params.pageSize,
      pageToken: (params.cursor as string) || undefined,
    });
    return { items: resp.files ?? [], nextCursor: resp.nextPageToken };
  });

  const columns: ProColumns<API.v1AdminFileInfo>[] = [
    { title: "ID", dataIndex: "id", width: 180, search: false },
    {
      title: "Owner 类型",
      dataIndex: "ownerType",
      valueType: "select",
      valueEnum: OWNER_TYPE_VALUE_ENUM,
      width: 110,
    },
    { title: "Owner ID", dataIndex: "ownerId", width: 180 },
    { title: "文件名", dataIndex: "filename", search: false },
    { title: "路径前缀", dataIndex: "pathPrefix", hideInTable: true },
    { title: "扩展名", dataIndex: "extension", hideInTable: true },
    { title: "大小", dataIndex: "size", search: false, width: 110, render: (_, r) => formatBytes(r.size) },
    {
      title: "公开",
      dataIndex: "isPublic",
      search: false,
      width: 80,
      render: (_, r) => (r.isPublic ? <Tag color="green">公开</Tag> : <Tag>私有</Tag>),
    },
    { title: "创建时间", dataIndex: "createdAt", valueType: "dateTime", search: false, width: 180 },
    {
      title: "操作",
      valueType: "option",
      width: 80,
      render: (_, r) => [
        <Popconfirm
          key="del"
          title="确认硬删除该文件？此操作不可恢复。"
          onConfirm={async () => {
            await adminDeleteFile({ fileId: r.id ?? "" });
            message.success("已删除");
            table.actionRef.current?.reload();
          }}
        >
          <a style={{ color: "red" }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  // PLATFORM 跨视图（未选租户）没有注入键，本页的租户收敛不成立 —— 指到
  // 切换器或跨租户面，而不是悄悄展示全量文件。
  if (view.crossView) {
    return (
      <PageContainer>
        <Alert
          type="info"
          showIcon
          message="请先在顶栏选择租户"
          description="租户文件是按租户收敛的视图（后端按注入租户键过滤）。跨租户的全量文件面请使用 存储管理 → 文件。"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ProTable<API.v1AdminFileInfo>
        headerTitle={view.tenantKey ? `租户 ${view.tenantKey} 的文件` : "本租户文件"}
        actionRef={table.actionRef}
        columns={columns}
        rowKey="id"
        search={{ labelWidth: "auto" }}
        pagination={false}
        options={spinReload}
        request={table.request}
        footer={() => table.pager}
      />
    </PageContainer>
  );
}
