/**
 * Admin file list. adminListFiles is cursor-based (pageToken), so following the
 * P2 convention this fetches a bounded first page with server pagination
 * disabled. ownerType/ownerId are operation-target filters (kept in request, not
 * ctx-injected). adminDeleteFile hard-deletes. access: canInternal at route.
 */
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { App, Popconfirm } from "antd";
import { useRef } from "react";
import {
  adminDeleteFile,
  adminListFiles,
} from "@/services/testkit/testkitService";
import {
  OWNER_TYPE_VALUE_ENUM,
  formatBytes,
} from "@/components/storagetags";

export default function AdminFilesPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);

  const columns: ProColumns<API.v1AdminFileInfo>[] = [
    { title: "ID", dataIndex: "id", width: 180, copyable: true, search: false },
    {
      title: "Owner 类型",
      dataIndex: "ownerType",
      valueType: "select",
      valueEnum: OWNER_TYPE_VALUE_ENUM,
      width: 110,
    },
    { title: "Owner ID", dataIndex: "ownerId", width: 180, copyable: true },
    { title: "文件名", dataIndex: "filename", search: false },
    { title: "路径前缀", dataIndex: "pathPrefix", hideInTable: true },
    { title: "扩展名", dataIndex: "extension", hideInTable: true },
    { title: "Provider", dataIndex: "provider" },
    { title: "Bucket", dataIndex: "bucket" },
    { title: "Object Key", dataIndex: "objectKey", search: false, copyable: true },
    {
      title: "大小",
      dataIndex: "size",
      search: false,
      width: 110,
      render: (_, r) => formatBytes(r.size),
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
            actionRef.current?.reload();
          }}
        >
          <a style={{ color: "red" }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.v1AdminFileInfo>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={{ labelWidth: "auto" }}
        pagination={false}
        request={async (params) => {
          const resp = await adminListFiles({
            ownerType:
              params.ownerType as API.AdminListFilesParams["ownerType"],
            ownerId: params.ownerId,
            provider: params.provider,
            bucket: params.bucket,
            pathPrefix: params.pathPrefix,
            extension: params.extension,
            pageSize: 100,
          });
          return {
            data: resp.files ?? [],
            total: resp.totalCount ?? 0,
            success: true,
          };
        }}
      />
    </PageContainer>
  );
}
