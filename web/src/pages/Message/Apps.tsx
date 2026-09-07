/**
 * 消息平台 · 应用管理。调用方的身份注册表：每个接入方一个 App，
 * 凭据（app_key/app_secret）只在此页创建/轮换时明文展示一次。
 */
import { ModalForm, ProFormDigit, ProFormText } from "@ant-design/pro-components";
import { App, Button, Modal, Popconfirm, Space, Tag } from "antd";
import { useRef } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  messageCreateApp,
  messageDeleteApp,
  messageListApps,
  messageRotateAppSecret,
  messageUpdateApp,
} from "@/services/testkit/testkitService";

function showSecret(title: string, resp: { appSecret?: string; app?: API.v1MessageAppInfo }) {
  Modal.info({
    title,
    width: 640,
    content: (
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {JSON.stringify(resp, null, 2)}
      </pre>
    ),
  });
}

export default function MessageAppsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();

  const columns: ProColumns<API.v1MessageAppInfo>[] = [
    { title: "ID", dataIndex: "id", width: 90, hideInSearch: true },
    { title: "AppKey", dataIndex: "appKey", copyable: true },
    { title: "名称", dataIndex: "name", hideInSearch: true },
    {
      title: "状态",
      dataIndex: "disabled",
      hideInSearch: true,
      width: 80,
      render: (_, r) => (r.disabled ? <Tag color="red">停用</Tag> : <Tag color="green">启用</Tag>),
    },
    {
      title: "短信日上限",
      dataIndex: "smsDailyLimit",
      hideInSearch: true,
      width: 100,
      render: (_, r) => (r.smsDailyLimit > 0 ? r.smsDailyLimit : "不限"),
    },
    {
      title: "邮件日上限",
      dataIndex: "emailDailyLimit",
      hideInSearch: true,
      width: 100,
      render: (_, r) => (r.emailDailyLimit > 0 ? r.emailDailyLimit : "不限"),
    },
    {
      title: "操作",
      valueType: "option",
      width: 240,
      render: (_, r) => [
        <a
          key="rotate"
          onClick={async () => {
            try {
              const resp = await messageRotateAppSecret({ id: r.id, body: {} } as never);
              message.success("已轮换（新 secret 仅此一次展示）");
              showSecret("新 App Secret", resp);
              reload();
            } catch (err) {
              const e = err as { data?: { message?: string } };
              message.error(e?.data?.message ?? "轮换失败");
            }
          }}
        >
          轮换密钥
        </a>,
        <a
          key="toggle"
          onClick={async () => {
            try {
              await messageUpdateApp({ id: r.id, body: { disabled: !r.disabled } } as never);
              message.success(r.disabled ? "已启用" : "已停用");
              reload();
            } catch (err) {
              const e = err as { data?: { message?: string } };
              message.error(e?.data?.message ?? "操作失败");
            }
          }}
        >
          {r.disabled ? "启用" : "停用"}
        </a>,
        <Popconfirm
          key="del"
          title="删除后该应用的发送立即失败，确定？"
          onConfirm={async () => {
            try {
              await messageDeleteApp({ id: r.id } as never);
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
      <ProTable<API.v1MessageAppInfo>
        headerTitle="应用列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        request={async () => {
          const resp = await messageListApps({});
          return { data: resp.apps ?? [], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="创建应用"
            trigger={<Button type="primary">创建应用</Button>}
            onFinish={async (vals) => {
              try {
                const resp = await messageCreateApp({
                  appKey: vals.appKey,
                  name: vals.name,
                  smsDailyLimit: Number(vals.smsDailyLimit ?? 0),
                  emailDailyLimit: Number(vals.emailDailyLimit ?? 0),
                });
                message.success("已创建（secret 仅此一次展示）");
                showSecret("App 凭据", resp);
                reload();
                return true;
              } catch (err) {
                const e = err as { data?: { message?: string } };
                message.error(e?.data?.message ?? "创建失败");
                return false;
              }
            }}
          >
            <ProFormText name="name" label="名称" rules={[{ required: true }]} />
            <ProFormDigit
              name="smsDailyLimit"
              label="短信日上限（0=不限）"
              min={0}
              fieldProps={{ precision: 0 }}
            />
            <ProFormDigit
              name="emailDailyLimit"
              label="邮件日上限（0=不限）"
              min={0}
              fieldProps={{ precision: 0 }}
            />
          </ModalForm>,
        ]}
      />
      <Space style={{ marginTop: 8, color: "#888" }}>
        凭据即权限：app_key 由系统自动生成，app_secret 只在创建/轮换时展示一次；发送端配置到 message.app_key/app_secret（见创建后的凭据弹窗）。
      </Space>
    </PageContainer>
  );
}
