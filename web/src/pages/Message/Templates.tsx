/**
 * 消息平台 · 模板管理。三种形态：
 * - 邮件：平台渲染 主题/文本/HTML（{{param}} 占位符）
 * - 国内短信：只存各厂商的模板码（内容在厂商控制台报备）
 * - 国际短信：平台渲染内容模板
 */
import {
  EditableProTable,
  ModalForm,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  type ProFormInstance,
} from "@ant-design/pro-components";
import { App, Button, Popconfirm, Tag } from "antd";
import { useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import {
  messageCreateTemplate,
  messageDeleteTemplate,
  messageListTemplates,
  messageUpdateTemplate,
} from "@/services/testkit/testkitService";
import { SMS_VENDOR_VALUE_ENUM } from "@/components/messagetags";

type Row = API.v1TemplateInfo;

const CHANNEL_KIND: Record<string, string> = {
  EMAIL: "TEMPLATE_KIND_EMAIL_RENDER",
  SMS: "TEMPLATE_KIND_SMS_VENDOR_CODES",
};
const KIND_LABEL: Record<string, string> = {
  TEMPLATE_KIND_EMAIL_RENDER: "邮件（平台渲染）",
  TEMPLATE_KIND_SMS_VENDOR_CODES: "国内短信（厂商模板码）",
  TEMPLATE_KIND_SMS_CONTENT: "国际短信（内容模板）",
};

function buildTemplateBody(vals: Record<string, unknown>): API.v1TemplateInfo {
  const kind = vals.kind as string;
  const params = (vals.params as API.v1TemplateParamSpec[] | undefined) ?? [];
  const tpl: API.v1TemplateInfo = {
    name: vals.name as string,
    kind,
    params,
    disabled: false,
  };
  if (kind === "TEMPLATE_KIND_EMAIL_RENDER") {
    tpl.channel = "EMAIL";
    tpl.email = {
      subject: vals.subject as string,
      textBody: vals.textBody as string,
      htmlBody: (vals.htmlBody as string) ?? "",
    };
  } else if (kind === "TEMPLATE_KIND_SMS_VENDOR_CODES") {
    tpl.channel = "SMS";
    tpl.vendorCodes = {
      codes: ((vals.codes as { vendor: string; templateCode: string }[] | undefined) ?? []).map(
        (c) => ({ vendor: c.vendor, templateCode: c.templateCode }),
      ),
    };
  } else {
    tpl.channel = "SMS";
    tpl.smsContent = { content: vals.content as string };
  }
  return tpl;
}

function TemplateForm({ formRef }: { formRef?: ProFormInstance }) {
  return (
    <>
      <ProFormSelect
        name="kind"
        label="模板形态"
        options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
        rules={[{ required: true }]}
      />
      <ProFormDependency name={["kind"]}>
        {({ kind }) => {
          if (!kind) return null;
          const isEmail = kind === "TEMPLATE_KIND_EMAIL_RENDER";
          const isVendorCodes = kind === "TEMPLATE_KIND_SMS_VENDOR_CODES";
          return (
            <>
              <ProFormText name="name" label="模板名称" rules={[{ required: true }]} />
              {isEmail && (
                <>
                  <ProFormText name="subject" label="主题（支持 {{param}}）" rules={[{ required: true }]} />
                  <ProFormText name="textBody" label="文本正文（支持 {{param}}）" rules={[{ required: true }]} />
                  <ProFormText name="htmlBody" label="HTML 正文（可空，支持 {{param}}）" />
                </>
              )}
              {isVendorCodes && (
                <EditableProTable<{ vendor: string; templateCode: string }>
                  name="codes"
                  label="厂商模板码（每家一行）"
                  recordCreatorProps={{ newRecordType: "dataSource", record: { vendor: "SMS_VENDOR_ALIYUN", templateCode: "" } }}
                  columns={[
                    {
                      title: "厂商",
                      dataIndex: "vendor",
                      valueType: "select",
                      valueEnum: SMS_VENDOR_VALUE_ENUM,
                      rules: [{ required: true }],
                      width: 140,
                      editable: true,
                    },
                    {
                      title: "模板码",
                      dataIndex: "templateCode",
                      rules: [{ required: true }],
                      editable: true,
                    },
                    { title: "操作", valueType: "option" },
                  ]}
                  rowKey="vendor"
                  style={{ marginBottom: 16 }}
                />
              )}
              {!isEmail && !isVendorCodes && (
                <ProFormText name="content" label="内容（支持 {{param}}）" rules={[{ required: true }]} />
              )}
              <EditableProTable<API.v1TemplateParamSpec>
                name="params"
                label="参数声明（验证码参数名固定 code）"
                recordCreatorProps={{ newRecordType: "dataSource", record: { name: "", required: true } }}
                columns={[
                  { title: "参数名", dataIndex: "name", rules: [{ required: true }], editable: true },
                  { title: "必填", dataIndex: "required", valueType: "switch", editable: true, width: 80 },
                  { title: "说明", dataIndex: "description", editable: true },
                  { title: "操作", valueType: "option" },
                ]}
                rowKey="name"
                style={{ marginBottom: 16 }}
              />
            </>
          );
        }}
      </ProFormDependency>
      {formRef ? null : null}
    </>
  );
}

export default function MessageTemplatesPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const [editing, setEditing] = useState<Row | null>(null);

  const columns: ProColumns<Row>[] = [
    { title: "ID", dataIndex: "id", width: 90, hideInSearch: true },
    { title: "名称", dataIndex: "name" },
    {
      title: "通道",
      dataIndex: "channel",
      hideInSearch: true,
      width: 80,
      render: (_, r) => <Tag>{r.channel === "EMAIL" ? "邮件" : "短信"}</Tag>,
    },
    {
      title: "形态",
      dataIndex: "kind",
      hideInSearch: true,
      render: (_, r) => KIND_LABEL[r.kind ?? ""] ?? r.kind,
    },
    {
      title: "内容",
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => {
        if (r.email) return `[${r.email.subject}] ${r.email.textBody}`;
        if (r.vendorCodes)
          return (r.vendorCodes.codes ?? []).map((c) => `${c.vendor}:${c.templateCode}`).join("，");
        return r.smsContent?.content ?? "-";
      },
    },
    {
      title: "参数",
      hideInSearch: true,
      render: (_, r) =>
        (r.params ?? []).map((p) => (
          <Tag key={p.name} color={p.required ? "blue" : undefined}>
            {p.name}
          </Tag>
        )),
    },
    {
      title: "操作",
      valueType: "option",
      width: 140,
      render: (_, r) => [
        <a key="edit" onClick={() => setEditing(r)}>
          编辑
        </a>,
        <Popconfirm
          key="del"
          title="删除后引用它的策略发送将失败，确定？"
          onConfirm={async () => {
            try {
              await messageDeleteTemplate({ id: r.id } as never);
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
      <ProTable<Row>
        headerTitle="模板列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        request={async () => {
          const resp = await messageListTemplates({});
          return { data: resp.templates ?? [], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="新建模板"
            width={680}
            trigger={<Button type="primary">新建模板</Button>}
            onFinish={async (vals) => {
              try {
                await messageCreateTemplate({ template: buildTemplateBody(vals) } as never);
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
            <TemplateForm />
          </ModalForm>,
        ]}
      />

      <ModalForm
        key={editing?.id ?? "none"}
        title={`编辑模板 #${editing?.id ?? ""}`}
        width={680}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        initialValues={(() => {
          if (!editing) return {};
          return {
            kind: editing.kind,
            name: editing.name,
            subject: editing.email?.subject,
            textBody: editing.email?.textBody,
            htmlBody: editing.email?.htmlBody,
            content: editing.smsContent?.content,
            codes: editing.vendorCodes?.codes,
            params: editing.params,
          };
        })()}
        onFinish={async (vals) => {
          if (!editing) return false;
          try {
            await messageUpdateTemplate({
              id: editing.id,
              template: buildTemplateBody(vals),
            } as never);
            message.success("已更新");
            setEditing(null);
            reload();
            return true;
          } catch (err) {
            const e = err as { data?: { message?: string } };
            message.error(e?.data?.message ?? "更新失败");
            return false;
          }
        }}
      >
        <TemplateForm />
      </ModalForm>
    </PageContainer>
  );
}
