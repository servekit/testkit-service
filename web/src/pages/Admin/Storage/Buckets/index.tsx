/**
 * Admin storage buckets — upsert (full replace: provider / prefix / ACL /
 * CDN) + delete (guarded while objects exist). CDN 必须每次完整重发。
 */
import {
  ModalForm,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Tag } from "antd";
import { useEffect, useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  adminDeleteBucket,
  adminListBuckets,
  adminListProviders,
  adminUpsertBucket,
} from "@/services/testkit/testkitService";
import { BUCKET_ACL_VALUE_ENUM, VENDOR_VALUE_ENUM } from "@/components/storagetags";

export default function AdminBucketsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const [providers, setProviders] = useState<{ label: string; value: string; vendor?: string }[]>([]);

  useEffect(() => {
    void adminListProviders()
      .then((r) =>
        setProviders(
          (r.providers ?? []).map((p) => ({
            label: `${p.name}（${VENDOR_VALUE_ENUM[p.vendor ?? ""]?.text ?? p.vendor}）`,
            value: p.name as string,
            vendor: p.vendor,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const columns: ProColumns<API.v1BucketInfo>[] = [
    { title: "桶名", dataIndex: "name" },
    { title: "服务商", dataIndex: "provider" },
    { title: "前缀", dataIndex: "keyPrefix", search: false },
    {
      title: "ACL",
      dataIndex: "acl",
      search: false,
      valueType: "select",
      valueEnum: BUCKET_ACL_VALUE_ENUM,
    },
    { title: "厂商", dataIndex: "vendor", search: false, valueType: "select", valueEnum: VENDOR_VALUE_ENUM },
    {
      title: "CDN",
      dataIndex: "cdn",
      search: false,
      render: (_, r) => (r.cdn?.domain ? <Tag color="blue">{r.cdn.domain}</Tag> : "—"),
    },
    {
      title: "操作",
      valueType: "option",
      width: 140,
      render: (_, r) => [
        <a
          key="upsert"
          onClick={async () => {
            try {
              await adminUpsertBucket({
                name: r.name,
                provider: r.provider,
                keyPrefix: r.keyPrefix ?? "",
                acl: r.acl,
                cdn: r.cdn ?? undefined,
              } as never);
              message.success("已保存（立即生效）");
              reload();
            } catch (err) {
              const e = err as { data?: { message?: string } };
              message.error(e?.data?.message ?? "保存失败");
            }
          }}
        >
          重放保存
        </a>,
        <Popconfirm
          key="del"
          title="桶内仍有对象时会被拒绝，确定删除绑定？"
          onConfirm={async () => {
            try {
              await adminDeleteBucket({ name: r.name } as never);
              message.success("已删除");
              reload();
            } catch (err) {
              const e = err as { data?: { message?: string } };
              message.error(e?.data?.message ?? "删除失败");
            }
          }}
        >
          <a style={{ color: "#cf1322" }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.v1BucketInfo>
        headerTitle="桶列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="name"
        search={false}
        pagination={false}
        request={async () => {
          const resp = await adminListBuckets();
          return { data: resp.buckets ?? [], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="upsert"
            title="新建/覆盖桶绑定"
            width={560}
            trigger={<Button type="primary">新建/覆盖桶</Button>}
            onFinish={async (vals) => {
              try {
                await adminUpsertBucket({
                  name: vals.name,
                  provider: vals.provider,
                  keyPrefix: vals.keyPrefix ?? "",
                  acl: vals.acl,
                  cdn: vals.cdnDomain
                    ? {
                        domain: vals.cdnDomain,
                        authKey: vals.cdnAuthKey ?? "",
                        keyPairId: vals.cdnKeyPairId ?? "",
                      }
                    : undefined,
                } as never);
                message.success("已保存（立即生效）");
                reload();
                return true;
              } catch (err) {
                const e = err as { data?: { message?: string } };
                message.error(e?.data?.message ?? "保存失败");
                return false;
              }
            }}
          >
            <ProFormText name="name" label="桶名" rules={[{ required: true }]} />
            <ProFormSelect name="provider" label="服务商" options={providers} rules={[{ required: true }]} />
            <ProFormText name="keyPrefix" label="Key 前缀（如 uploads/）" />
            <ProFormSelect
              name="acl"
              label="ACL"
              valueEnum={BUCKET_ACL_VALUE_ENUM}
              rules={[{ required: true }]}
            />
            <ProFormText name="cdnDomain" label="CDN 域名（空=关闭 CDN；覆盖保存需重发）" />
            <ProFormDependency name={["cdnDomain"]}>
              {({ cdnDomain }) =>
                cdnDomain ? (
                  <>
                    <ProFormText name="cdnAuthKey" label="CDN AuthKey" />
                    <ProFormText name="cdnKeyPairId" label="KeyPairID（仅 CloudFront 系）" />
                  </>
                ) : null
              }
            </ProFormDependency>
          </ModalForm>,
        ]}
      />
    </PageContainer>
  );
}
