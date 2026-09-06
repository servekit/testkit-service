/**
 * Self-service "My Files". Offset pagination via listMyFilesPaged (page/pageSize
 * + totalCount), filename/size/status columns, and per-row download / delete
 * plus batch delete. Owner is injected from ctx by the BFF, so no owner field
 * is sent. Upload lives in UploadModal (STS credential → OSS PUT → confirm).
 *
 * All RPCs come from the generated service layer — no hand-written fetch.
 */
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Space, Tag } from "antd";
import {
  DeleteOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useRef, useState } from "react";
import {
  batchDeleteMyFiles,
  deleteMyFile,
  generateDownloadUrl,
  listMyFilesPaged,
} from "@/services/testkit/testkitService";
import {
  SORT_FIELD_VALUE_ENUM,
  formatBytes,
} from "@/components/storagetags";
import UploadModal from "./UploadModal";

export default function MyFilesPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);

  const reload = () => {
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const handleDownload = async (fileId: string) => {
    const resp = await generateDownloadUrl({ fileId }, {});
    if (resp.downloadUrl) {
      window.open(resp.downloadUrl, "_blank");
    } else {
      message.warning("未获得下载地址");
    }
  };

  const handleDelete = async (fileId: string) => {
    await deleteMyFile({ fileId });
    message.success("已删除");
    reload();
  };

  const handleBatchDelete = async () => {
    const resp = await batchDeleteMyFiles({ fileIds: selectedRowKeys });
    message.success(`已删除 ${resp.deletedCount ?? 0} 个文件`);
    if (resp.failedIds?.length) {
      message.warning(`${resp.failedIds.length} 个文件删除失败`);
    }
    reload();
  };

  const columns: ProColumns<API.v1FileInfo>[] = [
    { title: "ID", dataIndex: "id", width: 180, copyable: true, search: false },
    {
      title: "文件名",
      dataIndex: "filename",
      render: (_, r) => r.filename || "-",
    },
    {
      title: "路径前缀",
      dataIndex: "pathPrefix",
      hideInTable: true,
    },
    {
      title: "扩展名",
      dataIndex: "extension",
      hideInTable: true,
    },
    {
      title: "Content-Type 前缀",
      dataIndex: "contentTypePrefix",
      hideInTable: true,
    },
    {
      title: "路径",
      dataIndex: "filePath",
      search: false,
      render: (_, r) => r.filePath || "-",
    },
    {
      title: "大小",
      dataIndex: "size",
      search: false,
      width: 110,
      render: (_, r) => formatBytes(r.size),
    },
    {
      title: "类型",
      dataIndex: "contentType",
      search: false,
      render: (_, r) => r.contentType || "-",
    },
    {
      title: "排序",
      dataIndex: "orderBy",
      valueType: "select",
      valueEnum: SORT_FIELD_VALUE_ENUM,
      hideInTable: true,
    },
    {
      title: "公开",
      dataIndex: "isPublic",
      valueType: "select",
      width: 80,
      search: false,
      render: (_, r) =>
        r.isPublic ? <Tag color="green">公开</Tag> : <Tag>私有</Tag>,
    },
    { title: "创建时间", dataIndex: "createdAt", valueType: "dateTime", search: false, width: 180 },
    {
      title: "操作",
      valueType: "option",
      width: 120,
      render: (_, r) => [
        <a key="dl" onClick={() => handleDownload(r.id ?? "")}>
          下载
        </a>,
        <Popconfirm
          key="del"
          title="确认删除该文件？"
          onConfirm={() => handleDelete(r.id ?? "")}
        >
          <a style={{ color: "red" }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.v1FileInfo>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={{ labelWidth: "auto" }}
        pagination={{ pageSize: 20 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        tableAlertOptionRender={() => (
          <Space>
            <Popconfirm
              title={`确认删除选中的 ${selectedRowKeys.length} 个文件？`}
              onConfirm={handleBatchDelete}
            >
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0}
              >
                批量删除
              </Button>
            </Popconfirm>
          </Space>
        )}
        request={async (params) => {
          const {
            current = 1,
            pageSize = 20,
            pathPrefix,
            extension,
            contentTypePrefix,
            orderBy,
          } = params;
          const resp = await listMyFilesPaged({
            page: current,
            pageSize,
            pathPrefix,
            extension,
            contentTypePrefix,
            orderBy: orderBy as API.ListMyFilesPagedParams["orderBy"],
          });
          return {
            data: resp.files ?? [],
            total: Number(resp.totalCount ?? 0),
            success: true,
          };
        }}
        toolBarRender={() => [
          <Button
            key="upload"
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setUploadOpen(true)}
          >
            上传
          </Button>,
        ]}
      />
      <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} onDone={reload} />
    </PageContainer>
  );
}
