/**
 * 消息平台 · 签名管理。短信签名（国内）/ sender ID（国际），
 * 与通道账号多对多绑定（报备关系）；策略路由按绑定校验。
 */
import {
  ModalForm,
  ProFormSelect,
  ProFormTextArea,
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
  messageCreateSignature,
  messageDeleteSignature,
  messageListChannelAccounts,
  messageListSignatures,
  messageUpdateSignature,
} from "@/services/testkit/testkitService";

export default function MessageSignaturesPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();

  // SMS accounts for the binding multi-select.
  const [smsAccounts, setSmsAccounts] = useState<{ label: string; value: number }[]>([]);
  useEffect(() => {
    void messageListChannelAccounts().then((resp) => {
      const items = (resp.accounts ?? []).filter(
        (a) => (a.vendor as { smsVendor?: string } | undefined)?.smsVendor,
      );
      setSmsAccounts(items.map((a) => ({ label: `${a.name}（#${a.id}）`, value: a.id as number })));
    });
  }, []);

  const columns: ProColumns<API.v1SignatureInfo>[] = [
    { title: "ID", dataIndex: "id", width: 90, hideInSearch: true },
    { title: "签名 / Sender ID", dataIndex: "name", copyable: true },
    {
      title: "已报备账号",
      dataIndex: "accountIds",
      hideInSearch: true,
      render: (_, r) =>
        (r.accountIds ?? []).map((id) => (
          <Tag key={id}>#{id}</Tag>
        )),
    },
    { title: "备注", dataIndex: "remark", hideInSearch: true },
    {
      title: "状态",
      dataIndex: "disabled",
      hideInSearch: true,
      width: 80,
      render: (_, r) => (r.disabled ? <Tag color="red">停用</Tag> : <Tag color="green">启用</Tag>),
    },
    {
      title: "操作",
      valueType: "option",
      width: 200,
      render: (_, r) => [
        <a
          key="toggle"
          onClick={async () => {
            try {
              await messageUpdateSignature({
                id: r.id,
                body: { disabled: !r.disabled },
              } as never);
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
          title="删除后引用它的策略路由将失败，确定？"
          onConfirm={async () => {
            try {
              await messageDeleteSignature({ id: r.id } as never);
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
      <ProTable<API.v1SignatureInfo>
        headerTitle="签名列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        request={async () => {
          const resp = await messageListSignatures();
          return { data: resp.signatures ?? [], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="新建签名"
            trigger={<Button type="primary">新建签名</Button>}
            onFinish={async (vals) => {
              try {
                await messageCreateSignature({
                  name: vals.name,
                  remark: vals.remark ?? "",
                  accountIds: vals.accountIds,
                } as never);
                message.success("已创建");
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
              name="name"
              label="签名串 / Sender ID"
              placeholder='国内如 "XX科技"；国际如 "MyApp"'
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="accountIds"
              label="已报备账号（多选）"
              mode="multiple"
              options={smsAccounts}
              rules={[{ required: true }]}
            />
            <ProFormTextArea name="remark" label="备注" />
          </ModalForm>,
        ]}
      />
    </PageContainer>
  );
}
