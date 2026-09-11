/**
 * 消息平台 · 模板管理。三种形态：
 * - 邮件：平台渲染 主题/文本/HTML（{{param}} 占位符）
 * - 国内短信：只存各厂商的模板码（内容在厂商控制台报备）
 * - 国际短信：平台渲染内容模板
 * phase ④ 租户化：归属列区分平台池（tenant_key NULL）与租户私有（由
 * app_id 派生——租户视图默认带本租户应用行建私有模板）；平台池行租户
 * 视图只读；跨视图（PLATFORM）全量 + 租户筛选器。
 */
import {
  EditableProTable,
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
  messageCreateTemplate,
  messageDeleteTemplate,
  messageListTenantConfigs,
  messageListTemplates,
  messageUpdateTemplate,
} from "@/services/testkit/testkitService";
import { SMS_VENDOR_VALUE_ENUM } from "@/components/messagetags";
import {
  TenantFilterSelect,
  applyTenantFilter,
  filterTenantRows,
  renderTenantScope,
  tenantFilterOptions,
  useTenantView,
} from "@/components/tenantScope";

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
  // 形态下拉的 value 即 v1TemplateKind 联合成员（KIND_LABEL 的键）。
  const kind = vals.kind as API.v1TemplateKind;
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
      codes: ((vals.codes as API.v1VendorTemplateCode[] | undefined) ?? []).map(
        (c) => ({ vendor: c.vendor, templateCode: c.templateCode }),
      ),
    };
  } else {
    tpl.channel = "SMS";
    tpl.smsContent = { content: vals.content as string };
  }
  return tpl;
}

function TemplateForm() {
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
                <EditableProTable<API.v1VendorTemplateCode>
                  name="codes"
                  recordCreatorProps={{ newRecordType: "dataSource", record: { vendor: "SMS_VENDOR_ALIYUN", templateCode: "" } }}
                  columns={[
                    {
                      title: "厂商",
                      dataIndex: "vendor",
                      valueType: "select",
                      valueEnum: SMS_VENDOR_VALUE_ENUM,
                      width: 140,
                    },
                    {
                      title: "模板码",
                      dataIndex: "templateCode",
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
                recordCreatorProps={{ newRecordType: "dataSource", record: { name: "", required: true } }}
                columns={[
                  { title: "参数名", dataIndex: "name" },
                  { title: "必填", dataIndex: "required", valueType: "switch", width: 80 },
                  { title: "说明", dataIndex: "description" },
                  { title: "操作", valueType: "option" },
                ]}
                rowKey="name"
                style={{ marginBottom: 16 }}
              />
            </>
          );
        }}
      </ProFormDependency>
    </>
  );
}

export default function MessageTemplatesPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const [editing, setEditing] = useState<Row | null>(null);
  const view = useTenantView();
  // 跨视图租户筛选（选项来自已加载行的 tenant_key 去重）。
  const [tenantFilter, setTenantFilter] = useState<string>("__all__");
  const [filterOptions, setFilterOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "__all__", label: "全部租户" }]);
  // 模板的私有归属由 app_id 派生（服务端 templateTenant）：租户视图需要
  // 本租户的应用行（tenant_key = choice）才能建私有模板；行未生成（首次
  // 发送前）时只能建平台共享模板。
  const [tenantAppId, setTenantAppId] = useState<string | undefined>(undefined);
  useEffect(() => {
    void messageListTenantConfigs({})
      .then((resp) => {
        const mine = (resp.configs ?? []).find((a) => a.tenantKey === view.tenantKey);
        setTenantAppId(mine?.id);
      })
      .catch(() => {
        // 应用列表加载失败：私有选项不可用，表单回落共享（服务端仍会拒绝
        // 未知 app_id，不会误建）。
      });
  }, [view.tenantKey, view.crossView]);

  const columns: ProColumns<Row>[] = [
    { title: "ID", dataIndex: "id", width: 90 },
    { title: "名称", dataIndex: "name" },
    {
      title: "归属",
      dataIndex: "tenantKey",
      width: 150,
      render: (_, r) => renderTenantScope(view, r.tenantKey),
    },
    {
      title: "通道",
      dataIndex: "channel",
      width: 80,
      render: (_, r) => <Tag>{r.channel === "EMAIL" ? "邮件" : "短信"}</Tag>,
    },
    {
      title: "形态",
      dataIndex: "kind",
      render: (_, r) => KIND_LABEL[r.kind ?? ""] ?? r.kind,
    },
    {
      title: "内容",
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
      render: (_, r) => {
        // 平台池行是共享基础设施：租户视图（非平台员工）只读。
        if (!view.canManage(r.tenantKey)) {
          return [<span key="ro" style={{ color: "#999" }}>平台维护</span>];
        }
        return [
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
        ];
      },
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
          let rows = filterTenantRows(view, resp.templates ?? [], (r) => r.tenantKey);
          if (view.crossView) {
            setFilterOptions(tenantFilterOptions(resp.templates ?? [], (r) => r.tenantKey));
            rows = applyTenantFilter(tenantFilter, rows, (r) => r.tenantKey);
          }
          return { data: rows, success: true };
        }}
        toolBarRender={() => [
          view.crossView ? (
            <TenantFilterSelect
              key="tenant-filter"
              value={tenantFilter}
              onChange={setTenantFilter}
              options={filterOptions}
            />
          ) : null,
          <ModalForm
            key="create"
            title="新建模板"
            width={680}
            trigger={<Button type="primary">新建模板</Button>}
            onFinish={async (vals) => {
              try {
                await messageCreateTemplate({
                  // 归属：租户视图默认私有（appId = 本租户应用行，服务端由
                  // app 派生 tenant_key）；「平台共享」/跨视图不带 app_id。
                  appId: !view.crossView && vals.scope === "private" ? tenantAppId : undefined,
                  template: buildTemplateBody(vals),
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
            {!view.crossView && (
              <ProFormSelect
                name="scope"
                label="归属"
                initialValue={tenantAppId ? "private" : "shared"}
                options={
                  tenantAppId
                    ? [
                        { value: "private", label: `本租户（${view.tenantKey}）` },
                        { value: "shared", label: "平台共享（平台池）" },
                      ]
                    : [{ value: "shared", label: "平台共享（租户应用行尚未生成，首次发送后自动建立）" }]
                }
              />
            )}
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
            await messageUpdateTemplate(
              { id: editing.id! },
              { template: buildTemplateBody(vals) },
            );
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
