/**
 * Admin storage apps — calling applications of the storage platform.
 * Every data-plane write authenticates as an app; its key_prefix is the
 * isolation & dedup domain. Create/rotate return the secret exactly once.
 */
import { ModalForm, ProFormDigit, ProFormText } from "@ant-design/pro-components";
import { App, Button, Modal, Popconfirm, Tag, Typography } from "antd";
import { useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  adminCreateApp,
  adminDeleteApp,
  adminListApps,
  adminRotateAppSecret,
  adminUpdateApp,
} from "@/services/testkit/testkitService";

interface StorageAppRow {
  id: string;
  appKey: string;
  name: string;
  keyPrefix: string;
  bucketId: string;
  disabled: boolean;
  createdAt: string;
}

export default function AdminStorageAppsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const [secretModal, setSecretModal] = useState<{ appKey: string; secret: string } | null>(null);

  const showSecret = (appKey: string, secret: string) => setSecretModal({ appKey, secret });

  const columns: ProColumns<StorageAppRow>[] = [
    { title: "AppKey", dataIndex: "appKey", copyable: true },
    { title: "名称", dataIndex: "name" },
    {
      title: "Key Prefix",
      dataIndex: "keyPrefix",
      copyable: true,
      render: (_, r) => <Tag color="blue">{r.keyPrefix}</Tag>,
    },
    {
      title: "绑定桶",
      dataIndex: "bucketId",
      search: false,
      width: 110,
      render: (_, r) => (Number(r.bucketId) === 0 ? <Tag>默认桶</Tag> : <Tag color="geekblue">#{r.bucketId}</Tag>),
    },
    {
      title: "状态",
      dataIndex: "disabled",
      search: false,
      width: 80,
      render: (_, r) => (r.disabled ? <Tag color="red">停用</Tag> : <Tag color="green">启用</Tag>),
    },
    {
      title: "操作",
      valueType: "option",
      width: 240,
      render: (_, r) => [
        <a
          key="toggle"
          onClick={async () => {
            try {
              await adminUpdateApp({ appKey: r.appKey }, { disabled: !r.disabled });
              message.success(r.disabled ? "已启用" : "已停用（数据面立即拒绝）");
              reload();
            } catch (err) {
              const e = err as { data?: { message?: string } };
              message.error(e?.data?.message ?? "操作失败");
            }
          }}
        >
          {r.disabled ? "启用" : "停用"}
        </a>,
        <a
          key="rotate"
          onClick={async () => {
            try {
              const resp = await adminRotateAppSecret({ appKey: r.appKey }, {});
              showSecret(r.appKey, (resp as { appSecret?: string }).appSecret ?? "");
              reload();
            } catch (err) {
              const e = err as { data?: { message?: string } };
              message.error(e?.data?.message ?? "轮换失败");
            }
          }}
        >
          轮换密钥
        </a>,
        <Popconfirm
          key="del"
          title="停用后数据面立即拒绝；存量对象仍可读。确定删除？"
          onConfirm={async () => {
            try {
              await adminDeleteApp({ appKey: r.appKey } as never);
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
      <ProTable<StorageAppRow>
        headerTitle="应用列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="appKey"
        search={false}
        pagination={false}
        request={async () => {
          const resp = await adminListApps();
          return { data: (resp.apps ?? []) as unknown as StorageAppRow[], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="新建应用"
            width={560}
            trigger={<Button type="primary">新建应用</Button>}
            onFinish={async (vals) => {
              try {
                const resp = await adminCreateApp({
                  appKey: vals.appKey ?? "",
                  name: vals.name,
                  keyPrefix: vals.keyPrefix,
                  bucketId: Number(vals.bucketId ?? 0),
                } as never);
                showSecret(
                  (resp as { app?: { appKey?: string } }).app?.appKey ?? vals.appKey ?? "",
                  (resp as { appSecret?: string }).appSecret ?? "",
                );
                reload();
                return true;
              } catch (err) {
                const e = err as { data?: { message?: string } };
                message.error(e?.data?.message ?? "创建失败");
                return false;
              }
            }}
          >
            <ProFormText
              name="appKey"
              label="AppKey（留空自动生成，创建后不可改）"
              placeholder="小写字母开头，可含数字与短横线"
            />
            <ProFormText name="name" label="名称" rules={[{ required: true }]} />
            <ProFormText
              name="keyPrefix"
              label="Key Prefix（对象命名空间，全局唯一且不可改，必须以 / 结尾）"
              rules={[
                { required: true },
                { pattern: /^[a-z][a-z0-9-]{1,62}\/$/, message: "格式：小写字母开头，字母/数字/短横线，以 / 结尾" },
              ]}
              placeholder="如 my-app/"
            />
            <ProFormDigit
              name="bucketId"
              label="绑定桶 ID（0 = 默认桶；PUBLIC 上传始终落公共桶）"
              min={0}
              fieldProps={{ precision: 0 }}
              placeholder="0"
            />
          </ModalForm>,
        ]}
      />
      <div style={{ marginTop: 8, color: "#888" }}>
        每个应用的对象都写在自己的 key_prefix 下，去重域 = prefix（跨应用同内容各存一份）；数据面调用需携带
        x-app-key / x-app-secret。
      </div>
      <Modal
        open={secretModal !== null}
        title={`密钥仅显示一次 — ${secretModal?.appKey ?? ""}`}
        onCancel={() => setSecretModal(null)}
        footer={[
          <Button key="copy" type="primary" onClick={() => {
            navigator.clipboard?.writeText(secretModal?.secret ?? "");
            message.success("已复制");
          }}>
            复制
          </Button>,
          <Button key="close" onClick={() => setSecretModal(null)}>
            我已保存
          </Button>,
        ]}
      >
        <Typography.Paragraph copyable style={{ wordBreak: "break-all" }}>
          {secretModal?.secret}
        </Typography.Paragraph>
        <Typography.Text type="warning">
          关闭后无法再次查看；请立即配置到调用方（如 testkit 的 cfg.Storage）。
        </Typography.Text>
      </Modal>
    </PageContainer>
  );
}
