/**
 * Admin storage buckets. adminListBuckets takes no args (no search); a bounded
 * list rendered in a ProTable. access: canInternal at the route level.
 */
import {
  PageContainer,
  ProTable,
  type ProColumns,
} from "@ant-design/pro-components";
import { adminListBuckets } from "@/services/testkit/testkitService";
import {
  BUCKET_ACL_VALUE_ENUM,
  VENDOR_VALUE_ENUM,
} from "@/components/storagetags";

export default function AdminBucketsPage() {
  const columns: ProColumns<API.v1BucketInfo>[] = [
    { title: "名称", dataIndex: "name", render: (_, r) => r.name || "-" },
    { title: "Provider", dataIndex: "provider", search: false },
    { title: "Key 前缀", dataIndex: "keyPrefix", search: false },
    {
      title: "ACL",
      dataIndex: "acl",
      valueType: "select",
      valueEnum: BUCKET_ACL_VALUE_ENUM,
    },
    {
      title: "厂商",
      dataIndex: "vendor",
      valueType: "select",
      valueEnum: VENDOR_VALUE_ENUM,
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.v1BucketInfo>
        columns={columns}
        rowKey={(r) => `${r.provider}/${r.name}`}
        search={false}
        pagination={false}
        request={async () => {
          const resp = await adminListBuckets();
          return { data: resp.buckets ?? [], success: true };
        }}
      />
    </PageContainer>
  );
}
