/**
 * Admin storage providers. adminListProviders takes no args (no search); a
 * bounded list rendered in a ProTable. access: canInternal at the route level.
 */
import {
  PageContainer,
  ProTable,
  type ProColumns,
} from "@ant-design/pro-components";
import { adminListProviders } from "@/services/testkit/testkitService";
import { VENDOR_VALUE_ENUM } from "@/components/storagetags";

export default function AdminProvidersPage() {
  const columns: ProColumns<API.v1ProviderInfo>[] = [
    { title: "名称", dataIndex: "name", render: (_, r) => r.name || "-" },
    {
      title: "厂商",
      dataIndex: "vendor",
      valueType: "select",
      valueEnum: VENDOR_VALUE_ENUM,
    },
    { title: "Endpoint", dataIndex: "endpoint", search: false },
    { title: "Region", dataIndex: "region", search: false },
  ];

  return (
    <PageContainer>
      <ProTable<API.v1ProviderInfo>
        columns={columns}
        rowKey="name"
        search={false}
        pagination={false}
        request={async () => {
          const resp = await adminListProviders();
          return { data: resp.providers ?? [], success: true };
        }}
      />
    </PageContainer>
  );
}
