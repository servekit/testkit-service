/**
 * 消息平台 · 通道账号。服务商凭据池（短信 5 家 + SMTP 邮件），
 * 策略路由引用这里的账号。密码类字段只在写入时提交，回显永远为空。
 * phase ④ 租户化：平台池（tenant_key NULL）与租户私有按「归属」区分——
 * 租户视图平台池行标「平台共享」只读、私有行「本租户」可管，创建默认
 * 私有；跨视图（PLATFORM）全量 + 租户筛选器。
 */
import {
  ModalForm,
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
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
  messageCreateChannelAccount,
  messageDeleteChannelAccount,
  messageListChannelAccounts,
  messageUpdateChannelAccount,
} from "@/services/testkit/testkitService";
import {
  TenantFilterSelect,
  applyTenantFilter,
  filterTenantRows,
  renderTenantScope,
  tenantFilterOptions,
  useTenantView,
} from "@/components/tenantScope";

const CRED_KINDS = [
  { label: "阿里云短信", value: "aliyun_sms" },
  { label: "腾讯云短信", value: "tencent_sms" },
  { label: "火山引擎短信", value: "volcengine_sms" },
  { label: "Byteplus 短信（国际）", value: "byteplus_sms" },
  { label: "华为云短信", value: "huawei_sms" },
  { label: "SMTP 邮件", value: "smtp" },
];

function buildCredentials(kind: string, v: Record<string, string | number>) {
  switch (kind) {
    case "aliyun_sms":
      return { aliyunSms: { accessKeyId: v.accessKey, accessKeySecret: v.accessSecret, regionId: v.region ?? "" } };
    case "tencent_sms":
      return { tencentSms: { secretId: v.accessKey, secretKey: v.accessSecret, smsSdkAppId: v.smsAccount, region: v.region ?? "" } };
    case "volcengine_sms":
      return { volcengineSms: { accessKey: v.accessKey, secretKey: v.accessSecret, smsAccount: v.smsAccount, region: v.region ?? "" } };
    case "byteplus_sms":
      return { byteplusSms: { accessKey: v.accessKey, secretKey: v.accessSecret, smsAccount: v.smsAccount, region: v.region ?? "" } };
    case "huawei_sms":
      return { huaweiSms: { appKey: v.accessKey, appSecret: v.accessSecret, sign: v.smsAccount, endpoint: v.region ?? "" } };
    case "smtp":
      return { smtp: { brand: v.brand, host: v.host, port: Number(v.port ?? 587), username: v.accessKey, password: v.accessSecret, fromAddress: v.fromAddress } };
    default:
      return {};
  }
}

export default function MessageAccountsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  const view = useTenantView();
  // 跨视图租户筛选（选项来自已加载行的 tenant_key 去重）。
  const [tenantFilter, setTenantFilter] = useState<string>("__all__");
  const [filterOptions, setFilterOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "__all__", label: "全部租户" }]);

  const columns: ProColumns<API.v1ChannelAccountInfo>[] = [
    { title: "ID", dataIndex: "id", width: 90 },
    { title: "名称", dataIndex: "name", copyable: true },
    {
      title: "归属",
      dataIndex: "tenantKey",
      width: 150,
      render: (_, r) => renderTenantScope(view, r.tenantKey),
    },
    {
      title: "类型",
      dataIndex: ["vendor"],
      render: (_, r) => {
        const v = r.smsVendor ?? r.emailVendor ?? "-";
        return <Tag>{v}</Tag>;
      },
    },
    { title: "备注", dataIndex: "remark" },
    {
      title: "状态",
      dataIndex: "disabled",
      width: 80,
      render: (_, r) => (r.disabled ? <Tag color="red">停用</Tag> : <Tag color="green">启用</Tag>),
    },
    {
      title: "操作",
      valueType: "option",
      width: 160,
      render: (_, r) => {
        // 平台池行是共享基础设施：租户视图（非平台员工）只读。
        if (!view.canManage(r.tenantKey)) {
          return [<span key="ro" style={{ color: "#999" }}>平台维护</span>];
        }
        return [
          <a
            key="toggle"
            onClick={async () => {
              try {
                await messageUpdateChannelAccount({ id: r.id! }, { disabled: !r.disabled });
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
            title="删除后引用它的策略路由将被跳过，确定？"
            onConfirm={async () => {
              try {
                await messageDeleteChannelAccount({ id: r.id } as never);
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

  const credForm = (
    <>
      <ProFormSelect
        name="kind"
        label="服务商"
        options={CRED_KINDS}
        rules={[{ required: true }]}
        // 已有账号编辑时换厂商 = 全量替换凭据
      />
      <ProFormDependency name={["kind"]}>
        {({ kind }) => {
          if (!kind) return null;
          const isSmtp = kind === "smtp";
          return (
            <>
              {!isSmtp && (
                <ProFormText
                  name="accessKey"
                  label={kind === "huawei_sms" ? "AppKey / AccessKey" : "AccessKey / SecretID"}
                  placeholder="留空 = 编辑时保持不变"
                  rules={[{ required: true }]}
                />
              )}
              <ProFormText
                name="accessSecret"
                label={isSmtp ? "密码" : "AccessSecret / SecretKey"}
                placeholder="留空 = 编辑时保持不变"
                rules={[{ required: true }]}
              />
              {isSmtp ? (
                <>
                  <ProFormSelect
                    name="brand"
                    label="品牌"
                    options={[
                      { label: "阿里云邮箱", value: "EMAIL_VENDOR_ALIYUN" },
                      { label: "腾讯企业邮", value: "EMAIL_VENDOR_TENCENT" },
                      { label: "网易企业邮", value: "EMAIL_VENDOR_NETEASE" },
                    ]}
                    rules={[{ required: true }]}
                  />
                  <ProFormText name="host" label="SMTP Host" rules={[{ required: true }]} />
                  <ProFormDigit name="port" label="端口" min={1} fieldProps={{ precision: 0 }} placeholder="587" />
                  <ProFormText name="fromAddress" label="发件地址" rules={[{ required: true }, { type: "email" }]} />
                </>
              ) : (
                <ProFormText
                  name="smsAccount"
                  label={
                    kind === "tencent_sms"
                      ? "SdkAppID"
                      : kind === "volcengine_sms" || kind === "byteplus_sms"
                        ? "SmsAccount"
                        : kind === "huawei_sms"
                          ? "签名（华为侧绑定）"
                          : "-"
                  }
                  rules={[{ required: kind !== "aliyun_sms" }]}
                />
              )}
              <ProFormText name="region" label="Region / Endpoint（可空）" />
            </>
          );
        }}
      </ProFormDependency>
    </>
  );

  return (
    <PageContainer>
      <ProTable<API.v1ChannelAccountInfo>
        headerTitle="通道账号池"
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        search={false}
        pagination={false}
        params={{ tenantFilter }}
        request={async () => {
          const resp = await messageListChannelAccounts();
          let rows = filterTenantRows(view, resp.accounts ?? [], (r) => r.tenantKey);
          if (view.crossView) {
            setFilterOptions(tenantFilterOptions(resp.accounts ?? [], (r) => r.tenantKey));
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
            title="新建通道账号"
            width={560}
            trigger={<Button type="primary">新建账号</Button>}
            onFinish={async (vals) => {
              try {
                await messageCreateChannelAccount({
                  name: vals.name,
                  remark: vals.remark ?? "",
                  credentials: buildCredentials(vals.kind, vals as Record<string, never>),
                  // 归属：租户视图默认本租户（私有）；跨视图（平台）入平台池。
                  tenantKey: view.crossView ? "" : (vals.tenantKey || ""),
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
            <ProFormText name="name" label="账号名（策略引用）" rules={[{ required: true }]} placeholder="如 aliyun-main" />
            {!view.crossView && (
              <ProFormSelect
                name="tenantKey"
                label="归属"
                initialValue={view.tenantKey}
                // 平台池归平台管（服务端只读裁定，phase ④ T5）——租户视图
                // 只能创建本租户私有资源，不再提供「平台共享」选项。
                options={[{ value: view.tenantKey, label: `本租户（${view.tenantKey}）` }]}
              />
            )}
            <ProFormTextArea name="remark" label="备注" />
            {credForm}
          </ModalForm>,
        ]}
      />
      <div style={{ marginTop: 8, color: "#888" }}>
        密钥只写不读：编辑时留空表示保持原值。换绑厂商需删除重建（凭据形状不同）。租户视图下「平台共享」行为平台池资源，只读。
      </div>
    </PageContainer>
  );
}
