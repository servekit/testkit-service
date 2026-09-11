import {
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { spinReload } from "@/components/TableOptions";
import { App, Button, Card, Form, InputNumber, Modal, Popconfirm, Select, Space, Tag } from "antd";
import { useRef, useState } from "react";
import {
  createKey,
  deleteKey,
  listKeys,
  revokeKey,
  showKey,
  unrevokeKey,
} from "@/services/testkit/testkitService";

/**
 * License key management: list / create / revoke / unrevoke / delete, with a
 * detail modal (ShowKey) surfacing entitlements and bound devices. Backed by
 * the embedded license-service admin surface.
 */
export default function LicenseKeysPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [detail, setDetail] = useState<API.v1KeyInfo | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const columns: ProColumns<API.v1KeyInfo>[] = [
    { title: "License ID", dataIndex: "licenseId", width: 220 },
    { title: "标签", dataIndex: "label", width: 160 },
    { title: "Key 前缀", dataIndex: "keyPrefix", width: 120 },
    {
      title: "席位",
      dataIndex: "maxSlots",
      width: 90,
      render: (_, r) => `${r.usedSlots ?? 0} / ${r.maxSlots ?? 0}`,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (_, r) =>
        r.status === "KEY_STATUS_ACTIVE" ? (
          <Tag color="green">正常</Tag>
        ) : (
          <Tag color="red">已吊销</Tag>
        ),
    },
    {
      title: "操作",
      valueType: "option",
      width: 280,
      render: (_, r) => [
        <Button
          key="detail"
          type="link"
          onClick={async () => {
            try {
              const resp = await showKey({ keyId: r.licenseId ?? "" });
              setDetail(resp?.key ?? r);
            } catch {
              setDetail(r);
            }
          }}
        >
          详情
        </Button>,
        <Popconfirm
          key="revoke"
          title={r.status === "KEY_STATUS_ACTIVE" ? "吊销该密钥？" : "恢复该密钥？"}
          onConfirm={async () => {
            if (r.status === "KEY_STATUS_ACTIVE") {
              await revokeKey({ keyId: r.licenseId ?? "" }, {});
            } else {
              await unrevokeKey({ keyId: r.licenseId ?? "" });
            }
            message.success("已操作");
            actionRef.current?.reload();
          }}
        >
          <Button type="link" danger={r.status === "KEY_STATUS_ACTIVE"}>
            {r.status === "KEY_STATUS_ACTIVE" ? "吊销" : "恢复"}
          </Button>
        </Popconfirm>,
        <Popconfirm
          key="del"
          title="永久删除该密钥？"
          onConfirm={async () => {
            await deleteKey({ keyId: r.licenseId ?? "" });
            message.success("已删除");
            actionRef.current?.reload();
          }}
        >
          <Button type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.v1KeyInfo>
        actionRef={actionRef}
        columns={columns}
        rowKey="licenseId"
        search={false}
        pagination={false}
        options={spinReload}
        request={async () => {
          const resp = await listKeys({ limit: 100 });
          return { data: resp?.keys ?? [], success: true };
        }}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            onClick={() => setCreateOpen(true)}
          >
            新建密钥
          </Button>,
        ]}
      />
      <ModalForm<{
        label: string;
        slots: number;
        // module/kind 的下拉 value 即 v1Module / v1EntitlementKind 联合成员。
        grants?: API.v1EntitlementInput[];
      }>
        title="新建密钥"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={async (vals) => {
          try {
            const resp = await createKey({
              label: vals.label,
              slots: vals.slots,
              grants: (vals.grants ?? []).map((g) => ({
                module: g.module,
                kind: g.kind,
                // perpetual grants carry no duration; subscription/trial send
                // duration_days (0 = omit and let the backend default).
                durationDays:
                  g.kind === "ENTITLEMENT_KIND_PERPETUAL" ? 0 : g.durationDays ?? 0,
              })),
            });
            Modal.info({
              title: "密钥已创建（完整 key 仅此一次展示）",
              width: 640,
              content: (
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {JSON.stringify(resp, null, 2)}
                </pre>
              ),
            });
            actionRef.current?.reload();
            return true;
          } catch (err) {
            const e = err as { data?: { message?: string } };
            message.error(e?.data?.message ?? "创建失败");
            return false;
          }
        }}
      >
        <ProFormText
          name="label"
          label="标签"
          placeholder="如：客户A / 内部测试"
          rules={[{ required: true, message: "请输入标签" }]}
        />
        <ProFormDigit
          name="slots"
          label="设备席位数"
          initialValue={3}
          min={1}
          max={100}
        />
        <Card
          size="small"
          title="模块授权（可选，可多条）"
          style={{ marginBlockEnd: 16 }}
        >
          <Form.List name="grants">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Card size="small" key={field.key} style={{ marginBlockEnd: 8 }}>
                    <Space key={field.key} align="baseline">
                      <Form.Item
                        name={[field.name, "module"]}
                        rules={[{ required: true, message: "请选择模块" }]}
                        noStyle
                      >
                        <Select
                          placeholder="模块"
                          style={{ width: 160 }}
                          options={[
                            { value: "MODULE_DOWNLOADS", label: "下载模块" },
                            { value: "MODULE_TOOLS", label: "工具模块" },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "kind"]}
                        rules={[{ required: true, message: "请选择类型" }]}
                        noStyle
                      >
                        <Select
                          placeholder="授权类型"
                          style={{ width: 140 }}
                          options={[
                            { value: "ENTITLEMENT_KIND_PERPETUAL", label: "永久" },
                            { value: "ENTITLEMENT_KIND_SUBSCRIPTION", label: "订阅" },
                            { value: "ENTITLEMENT_KIND_TRIAL", label: "试用" },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, cur) =>
                          prev.grants?.[field.name]?.kind !==
                          cur.grants?.[field.name]?.kind
                        }
                      >
                        {({ getFieldValue }) => {
                          const kind = getFieldValue([
                            "grants",
                            field.name,
                            "kind",
                          ]);
                          return kind && kind !== "ENTITLEMENT_KIND_PERPETUAL" ? (
                            <Form.Item
                              name={[field.name, "durationDays"]}
                              noStyle
                            >
                              <InputNumber
                                placeholder="时长（天）"
                                min={1}
                                max={3650}
                                addonAfter="天"
                              />
                            </Form.Item>
                          ) : null;
                        }}
                      </Form.Item>
                      <Button
                        type="link"
                        danger
                        onClick={() => remove(field.name)}
                      >
                        删除
                      </Button>
                    </Space>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() =>
                    add({ module: "MODULE_DOWNLOADS", kind: "ENTITLEMENT_KIND_PERPETUAL" })
                  }
                  block
                >
                  + 添加模块授权
                </Button>
              </>
            )}
          </Form.List>
        </Card>
      </ModalForm>
      <Modal
        title="密钥详情"
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={720}
      >
        {detail && (
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {JSON.stringify(detail, null, 2)}
          </pre>
        )}
      </Modal>
    </PageContainer>
  );
}
