/**
 * Storage runtime settings: default bucket (uploads without an explicit
 * bucket) + public bucket (visibility=PUBLIC). Referenced buckets must exist.
 */
import { ProForm, ProFormSelect } from "@ant-design/pro-components";
import { App, Card } from "antd";
import { useEffect, useState } from "react";
import { PageContainer } from "@ant-design/pro-components";
import { adminGetSettings, adminListBuckets, adminUpdateSettings } from "@/services/testkit/testkitService";

export default function AdminStorageSettingsPage() {
  const { message } = App.useApp();
  const [form] = ProForm.useForm();
  const [buckets, setBuckets] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    void adminGetSettings().then((r) => {
      form.setFieldsValue({
        defaultBucket: r.settings?.defaultBucket,
        publicBucket: r.settings?.publicBucket,
      });
    });
    void adminListBuckets()
      .then((r) => setBuckets((r.buckets ?? []).map((b) => ({ label: b.name as string, value: b.name as string }))))
      .catch(() => {});
  }, [form]);

  return (
    <PageContainer>
      <Card title="存储设置">
        <ProForm
          form={form}
          onFinish={async (vals) => {
            try {
              await adminUpdateSettings({
                defaultBucket: vals.defaultBucket ?? "",
                publicBucket: vals.publicBucket ?? "",
              } as never);
              message.success("已保存（立即生效）");
            } catch (err) {
              const e = err as { data?: { message?: string } };
              message.error(e?.data?.message ?? "保存失败");
            }
          }}
          submitter={{ searchConfig: { submitText: "保存" }, resetButtonProps: { style: { display: "none" } } }}
        >
          <ProFormSelect
            name="defaultBucket"
            label="默认桶（未指定桶的上传落到这里）"
            options={buckets}
            placeholder="必选；空则无桶上传全部失败"
          />
          <ProFormSelect
            name="publicBucket"
            label="公开桶（visibility=PUBLIC 的上传）"
            options={buckets}
            placeholder="可选；空 = 拒绝 PUBLIC 上传"
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
}
