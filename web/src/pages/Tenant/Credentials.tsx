/**
 * 租户管理 · 密钥（ak/sk）管理（tenant platform spec §5.2）。
 *
 * - TENANT_ADMIN：操作当前切换租户（顶栏切换器选中者——请求头带 choice，
 *   后端还会用注入键覆写请求体里的 tenant_key，双保险）；只能管本租户。
 * - PLATFORM：页内选择目标租户（ListTenants），任意租户可管。
 *
 * secret 只在 创建 / 轮换 的响应里出现一次（落库即 bcrypt 哈希，列表永不
 * 返回）——弹窗展示 + 复制，关闭即散。
 */
import { useModel } from "@umijs/max";
import {
  ModalForm,
  ProFormText,
} from "@ant-design/pro-components";
import {
  App,
  Alert,
  Button,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect, useRef, useState } from "react";
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from "@ant-design/pro-components";
import { SecretText } from "@/components/SecretText";
import {
  portalCreateApiKey,
  portalDisableApiKey,
  portalListApiKeys,
  portalListTenants,
  portalRotateApiKeySecret,
} from "@/services/testkit/testkitService";
import { readTenantChoice } from "@/utils/tenantChoice";

const USER_TYPE_PLATFORM = "USER_TYPE_PLATFORM";

function bizMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string } };
  return e?.data?.message ?? fallback;
}

/** secret 只显一次的弹窗：ak 与新 sk 并列，复制可用。 */
function showSecretOnce(title: string, accessKey?: string, secret?: string) {
  Modal.info({
    title,
    width: 640,
    content: (
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Alert
          type="warning"
          showIcon
          message="Secret 仅此一次展示：关闭后无法再次查看，请立即保存到安全的地方。"
        />
        <div>
          <Typography.Text type="secondary">AccessKey：</Typography.Text>
          <Typography.Text code copyable>
            {accessKey ?? "-"}
          </Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">Secret：</Typography.Text>
          <SecretText value={secret} visible onToggle={() => {}} />
        </div>
      </Space>
    ),
  });
}

export default function TenantCredentialsPage() {
  const { message } = App.useApp();
  const { initialState } = useModel("@@initialState");
  const isPlatform =
    initialState?.currentUser?.userType === USER_TYPE_PLATFORM;
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();

  // PLATFORM 的目标租户选择（drill-down）；TENANT_ADMIN 固定为切换器选中租户。
  const [tenants, setTenants] = useState<API.TenantInfo[]>([]);
  const [tenantKey, setTenantKey] = useState<string>(readTenantChoice());
  useEffect(() => {
    if (!isPlatform) return;
    let alive = true;
    portalListTenants()
      .then((resp) => {
        if (!alive) return;
        const list = resp.tenants ?? [];
        setTenants(list);
        setTenantKey((cur) =>
          cur && list.some((t) => t.tenantKey === cur)
            ? cur
            : (list[0]?.tenantKey ?? ""),
        );
      })
      .catch((err) => message.error(bizMessage(err, "租户列表加载失败")));
    return () => {
      alive = false;
    };
  }, [isPlatform, message]);

  type Row = API.ApiKeyInfo;

  const columns: ProColumns<Row>[] = [
    { title: "名称", dataIndex: "name", width: 160, ellipsis: true },
    {
      title: "AccessKey",
      dataIndex: "accessKey",
      width: 170,
      render: (_, r) => <code>{r.accessKey}</code>,
    },
    {
      title: "状态",
      dataIndex: "disabled",
      width: 90,
      render: (_, r) =>
        r.disabled ? <Tag color="red">已停用</Tag> : <Tag color="green">生效中</Tag>,
    },
    {
      title: "最近使用",
      dataIndex: "lastUsedAt",
      width: 170,
      render: (_, r) =>
        r.lastUsedAt && Number(r.lastUsedAt) > 0
          ? new Date(Number(r.lastUsedAt) * 1000).toLocaleString()
          : "从未使用",
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 170,
      render: (_, r) =>
        r.createdAt && Number(r.createdAt) > 0
          ? new Date(Number(r.createdAt) * 1000).toLocaleString()
          : "-",
    },
    {
      title: "操作",
      valueType: "option",
      width: 150,
      render: (_, r) => [
        <Popconfirm
          key="rotate"
          title="轮换 Secret？旧 Secret 立即失效，请先确认接入方已准备好切换。"
          onConfirm={async () => {
            try {
              const resp = await portalRotateApiKeySecret(
                { accessKey: r.accessKey ?? "" },
                {} as never,
              );
              message.success("已轮换");
              showSecretOnce(
                "新 Secret（仅此一次）",
                resp.apiKey?.accessKey,
                resp.secret,
              );
              reload();
            } catch (err) {
              message.error(bizMessage(err, "轮换失败"));
            }
          }}
        >
          <a>轮换密钥</a>
        </Popconfirm>,
        <Popconfirm
          key="toggle"
          title={r.disabled ? "重新启用该密钥？" : "停用该密钥？停用后认证立即失败。"}
          onConfirm={async () => {
            try {
              await portalDisableApiKey(
                { accessKey: r.accessKey ?? "" },
                { disable: !r.disabled, reason: "控制台切换" },
              );
              message.success(r.disabled ? "已启用" : "已停用");
              reload();
            } catch (err) {
              message.error(bizMessage(err, "操作失败"));
            }
          }}
        >
          <a>{r.disabled ? "启用" : "停用"}</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<Row>
        headerTitle="密钥列表"
        actionRef={actionRef}
        columns={columns}
        rowKey="accessKey"
        search={false}
        pagination={false}
        params={{ tenantKey }}
        request={async ({ tenantKey: tk }) => {
          if (!tk) return { data: [], success: true };
          const resp = await portalListApiKeys({ tenantKey: tk as string });
          return { data: resp.apiKeys ?? [], success: true };
        }}
        toolBarRender={() => [
          isPlatform ? (
            <Select
              key="tenant"
              size="small"
              style={{ minWidth: 220 }}
              popupMatchSelectWidth={false}
              showSearch
              optionFilterProp="label"
              placeholder="选择租户"
              value={tenantKey || undefined}
              onChange={setTenantKey}
              options={tenants.map((t) => ({
                value: t.tenantKey ?? "",
                label: t.name ? `${t.name}（${t.tenantKey}）` : (t.tenantKey ?? ""),
              }))}
            />
          ) : (
            <Typography.Text key="cur" type="secondary">
              当前租户：<code>{tenantKey || "（未选择）"}</code>
            </Typography.Text>
          ),
          <ModalForm
            key="create"
            title="新建密钥"
            width={480}
            disabled={!tenantKey}
            onFinish={async (vals) => {
              try {
                const resp = await portalCreateApiKey(
                  { tenantKey },
                  { name: vals.name },
                );
                message.success("已创建");
                showSecretOnce(
                  "新密钥（仅此一次）",
                  resp.apiKey?.accessKey,
                  resp.secret,
                );
                reload();
                return true;
              } catch (err) {
                message.error(bizMessage(err, "创建失败"));
                return false;
              }
            }}
            trigger={
              <Button key="create" type="primary" disabled={!tenantKey}>
                新建密钥
              </Button>
            }
          >
            <ProFormText
              name="name"
              label="名称"
              rules={[{ required: true, message: "请输入密钥名称" }]}
            />
          </ModalForm>,
        ]}
      />
    </PageContainer>
  );
}
