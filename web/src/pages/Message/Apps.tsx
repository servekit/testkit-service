/**
 * 消息平台 · 应用管理。调用方的身份注册表：每个接入方一个 App，
 * 凭据（app_key/app_secret）列表可见（内网信任 posture）：默认掩码，
 * 点眼睛显示明文、点复制取值，方便配置到发送端的
 * message.app_key / app_secret。
 */
import { ModalForm, ProFormDigit, ProFormText } from "@ant-design/pro-components";
import {
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { App, Button, Popconfirm, Space, Tag } from "antd";
import { useRef, useState } from "react";
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

/** 凭据单元格：默认星号掩码，眼睛切换明文，复制按钮取值。显隐状态由页面持有。 */
function SecretText({
  value,
  visible,
  onToggle,
}: {
  value?: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const { message } = App.useApp();
  return (
    <Space size={2}>
      <span
        style={{
          fontFamily: "monospace",
          wordBreak: "break-all",
          display: "inline-block",
          minWidth: 64,
        }}
      >
        {visible ? value || "-" : "••••••••••"}
      </span>
      <Button
        type="text"
        size="small"
        icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        onClick={onToggle}
      />
      <Button
        type="text"
        size="small"
        icon={<CopyOutlined />}
        onClick={async () => {
          if (!value) return;
          try {
            await navigator.clipboard.writeText(value);
            message.success("已复制");
          } catch {
            message.error("复制失败，请手动选择复制");
          }
        }}
      />
    </Space>
  );
}

export default function MessageAppsPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const reload = () => actionRef.current?.reload();
  // 掩码开关按 "id:字段" 记忆；创建/轮换后自动点亮对应行的 AppSecret
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggleReveal = (key: string) =>
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  const reveal = (id: string | undefined, field: string) => {
    if (id) setRevealed((prev) => ({ ...prev, [`${id}:${field}`]: true }));
  };

  const columns: ProColumns<API.v1MessageAppInfo>[] = [
    { title: "名称", dataIndex: "name", hideInSearch: true, width: 140, ellipsis: true },
    {
      title: "AppKey",
      dataIndex: "appKey",
      width: 240,
      render: (_, r) => (
        <SecretText
          value={r.appKey}
          visible={!!revealed[`${r.id}:appKey`]}
          onToggle={() => toggleReveal(`${r.id}:appKey`)}
        />
      ),
    },
    {
      title: "AppSecret",
      dataIndex: "appSecret",
      width: 420,
      render: (_, r) => (
        <SecretText
          value={r.appSecret}
          visible={!!revealed[`${r.id}:appSecret`]}
          onToggle={() => toggleReveal(`${r.id}:appSecret`)}
        />
      ),
    },
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
      render: (_, r) => (Number(r.smsDailyLimit) > 0 ? Number(r.smsDailyLimit) : "不限"),
    },
    {
      title: "邮件日上限",
      dataIndex: "emailDailyLimit",
      hideInSearch: true,
      width: 100,
      render: (_, r) => (Number(r.emailDailyLimit) > 0 ? Number(r.emailDailyLimit) : "不限"),
    },
    {
      title: "操作",
      valueType: "option",
      width: 200,
      render: (_, r) => [
        <a
          key="rotate"
          onClick={async () => {
            try {
              await messageRotateAppSecret({ id: r.id! }, {} as never);
              message.success("已轮换，新 AppSecret 见列表");
              reveal(r.id, "appSecret");
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
              await messageUpdateApp({ id: r.id! }, { disabled: !r.disabled });
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
              await messageDeleteApp({ id: r.id! });
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
        scroll={{ x: 1280 }}
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
                  name: vals.name,
                  smsDailyLimit: String(Number(vals.smsDailyLimit ?? 0)),
                  emailDailyLimit: String(Number(vals.emailDailyLimit ?? 0)),
                });
                message.success("已创建，AppKey/AppSecret 见列表");
                reveal(resp.app?.id, "appSecret");
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
        凭据即权限：app_key/app_secret 由系统生成，列表默认掩码；点眼睛显示明文、点复制取值，配置到发送端的
        message.app_key / message.app_secret。轮换后旧 secret 立即失效。
      </Space>
    </PageContainer>
  );
}
