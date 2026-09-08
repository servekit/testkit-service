/**
 * 消息平台 · 发送策略。绑定 (应用 × 通道 × 场景) → 模板 + 有序路由链：
 * 权重决定起点，失败沿列表顺序降级。短信分国内/国际两条链。
 */
import {
  EditableProTable,
  ModalForm,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  type ProFormInstance,
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
  messageCreatePolicy,
  messageDeletePolicy,
  messageListApps,
  messageListChannelAccounts,
  listPolicies,
  messageListSignatures,
  messageListTemplates,
  messageUpdatePolicy,
} from "@/services/testkit/testkitService";
import { EMAIL_SCENE_OPTIONS, SMS_SCENE_OPTIONS } from "@/components/messagetags";

type Row = API.v1PolicyInfo;

interface Options {
  apps: { label: string; value: string }[];
  templates: { label: string; value: string }[];
  accounts: { label: string; value: string; sms: boolean }[];
  signatures: Record<string, string>; // id -> name
}

function routeTableLabel(opts: Options, sms: boolean) {
  return [
    {
      title: "账号",
      dataIndex: "accountId",
      valueType: "select" as const,
      fieldProps: {
        options: opts.accounts.filter((a) => a.sms === sms).map((a) => ({ label: a.label, value: a.value })),
      },
      rules: [{ required: true }],
      width: 200,
      editable: true,
    },
    ...(sms
      ? [
          {
            title: "签名",
            dataIndex: "signatureId",
            valueType: "select" as const,
            fieldProps: {
              options: Object.entries(opts.signatures).map(([value, name]) => ({
                label: name,
                value,
              })),
            },
            rules: [{ required: true }],
            width: 160,
            editable: true,
          },
        ]
      : []),
    {
      title: "权重",
      dataIndex: "weight",
      valueType: "digit" as const,
      fieldProps: { precision: 0, min: 1 },
      width: 90,
      editable: true,
    },
    { title: "操作", valueType: "option" as const },
  ];
}

function PolicyForm({ opts }: { opts: Options }) {
  return (
    <>
      <ProFormSelect
        name="appId"
        label="应用"
        options={opts.apps}
        rules={[{ required: true }]}
      />
      <ProFormSelect
        name="channel"
        label="通道"
        options={[
          { label: "邮件", value: "EMAIL" },
          { label: "短信", value: "SMS" },
        ]}
        rules={[{ required: true }]}
      />
      <ProFormDependency name={["channel"]}>
        {({ channel }) => (
          <ProFormSelect
            name="scene"
            label="场景"
            options={channel === "SMS" ? SMS_SCENE_OPTIONS : EMAIL_SCENE_OPTIONS}
            rules={[{ required: true }]}
          />
        )}
      </ProFormDependency>
      <ProFormSelect
        name="templateId"
        label="模板（通道需匹配）"
        options={opts.templates}
        rules={[{ required: true }]}
      />
      <ProFormDependency name={["channel"]}>
        {({ channel }) => {
          const sms = channel === "SMS";
          return (
            <>
              <EditableProTable
                name="routes"
                label={sms ? "国内路由链（有序降级）" : "路由链（有序降级）"}
                recordCreatorProps={{
                  newRecordType: "dataSource",
                  record: { weight: 1 },
                }}
                columns={routeTableLabel(opts, sms)}
                rowKey={(r, i) => String((r as { accountId?: string })?.accountId ?? i)}
                style={{ marginBottom: 16 }}
              />
              {sms && (
                <EditableProTable
                  name="intlRoutes"
                  label="国际路由链（可空 = 拒绝国际发送）"
                  recordCreatorProps={{
                    newRecordType: "dataSource",
                    record: { weight: 1 },
                  }}
                  columns={routeTableLabel(opts, true)}
                  rowKey={(r, i) => String((r as { accountId?: string })?.accountId ?? i)}
                  style={{ marginBottom: 16 }}
                />
              )}
            </>
          );
        }}
      </ProFormDependency>
    </>
  );
}

export default function MessagePoliciesPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const [editing, setEditing] = useState<Row | null>(null);
  const formRef = useRef<ProFormInstance>(null);
  const [opts, setOpts] = useState<Options>({ apps: [], templates: [], accounts: [], signatures: {} });

  useEffect(() => {
    void (async () => {
      const [apps, templates, accounts, signatures] = await Promise.all([
        messageListApps({}),
        messageListTemplates({}),
        messageListChannelAccounts(),
        messageListSignatures(),
      ]);
      setOpts({
        apps: (apps.apps ?? []).map((a) => ({ label: `${a.appKey}（#${a.id}）`, value: a.id as string })),
        templates: (templates.templates ?? []).map((t) => ({
          label: `${t.name}（#${t.id}，${t.channel === "EMAIL" ? "邮件" : "短信"}）`,
          value: t.id as string,
        })),
        accounts: (accounts.accounts ?? []).map((a) => ({
          label: `${a.name}（#${a.id}）`,
          value: a.id as string,
          sms: !!(a.vendor as { smsVendor?: string } | undefined)?.smsVendor,
        })),
        signatures: Object.fromEntries(
          (signatures.signatures ?? []).map((s) => [String(s.id), String(s.name)]),
        ),
      });
    })();
  }, []);

  const submit = async (vals: Record<string, unknown>, id?: string) => {
    const body = {
      appId: vals.appId,
      scene:
        vals.channel === "SMS"
          ? { smsScene: vals.scene }
          : { emailScene: vals.scene },
      templateId: vals.templateId,
      routes: (vals.routes as API.v1RouteRule[] | undefined) ?? [],
      intlRoutes: (vals.intlRoutes as API.v1RouteRule[] | undefined) ?? [],
    };
    try {
      if (id) {
        await messageUpdatePolicy(
          { id },
          { templateId: body.templateId as string, routes: body.routes, intlRoutes: body.intlRoutes },
        );
      } else {
        await messageCreatePolicy(body as never);
      }
      message.success(id ? "已更新" : "已创建");
      setEditing(null);
      reload();
      return true;
    } catch (err) {
      const e = err as { data?: { message?: string } };
      message.error(e?.data?.message ?? (id ? "更新失败" : "创建失败"));
      return false;
    }
  };

  const columns: ProColumns<Row>[] = [
    { title: "ID", dataIndex: "id", width: 90, hideInSearch: true },
    {
      title: "应用",
      hideInSearch: true,
      render: (_, r) => {
        const app = opts.apps.find((a) => a.value === r.appId);
        return app?.label ?? r.appId;
      },
    },
    {
      title: "场景",
      hideInSearch: true,
      render: (_, r) => (
        <Tag>{r.channel === "EMAIL" ? r.emailScene : r.smsScene}</Tag>
      ),
    },
    {
      title: "模板",
      hideInSearch: true,
      render: (_, r) => {
        const tpl = opts.templates.find((t) => t.value === r.templateId);
        return tpl?.label ?? r.templateId;
      },
    },
    {
      title: "路由链",
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) =>
        (r.routes ?? [])
          .map((rr) => `#${rr.accountId}${rr.signatureId ? `/签名#${rr.signatureId}` : ""}×${rr.weight ?? 1}`)
          .join(" → "),
    },
    {
      title: "国际链",
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) =>
        (r.intlRoutes ?? []).length === 0
          ? "—"
          : (r.intlRoutes ?? []).map((rr) => `#${rr.accountId}×${rr.weight ?? 1}`).join(" → "),
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
          title="删除后该场景发送立即失败（fail-closed），确定？"
          onConfirm={async () => {
            try {
              await messageDeletePolicy({ id: r.id } as never);
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
        headerTitle="发送策略"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        request={async () => {
          const resp = await listPolicies({});
          return { data: resp.policies ?? [], success: true };
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="新建策略"
            width={720}
            trigger={<Button type="primary">新建策略</Button>}
            onFinish={async (vals) => submit(vals)}
          >
            <PolicyForm opts={opts} />
          </ModalForm>,
        ]}
      />

      <ModalForm
        key={editing?.id ?? "none"}
        title={`编辑策略 #${editing?.id ?? ""}`}
        width={720}
        formRef={formRef}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        initialValues={(() => {
          if (!editing) return {};
          return {
            appId: editing.appId,
            channel: editing.channel,
            scene: editing.channel === "SMS" ? editing.smsScene : editing.emailScene,
            templateId: editing.templateId,
            routes: editing.routes,
            intlRoutes: editing.intlRoutes,
          };
        })()}
        onFinish={async (vals) => editing && submit(vals, editing.id)}
      >
        <PolicyForm opts={opts} />
      </ModalForm>
    </PageContainer>
  );
}
