import { Tag } from "antd";

/**
 * Shared label/tag renderers + ProTable valueEnums for the P4 message-domain
 * enums.
 *
 * Mirrors storagetags.tsx / usertags.tsx: enum values are the proto string-union
 * values generated into API.v1* (which mirror message-service by name+number).
 * UNSPECIFIED is mapped to "全部" so it reads as "no filter" in ProTable search
 * selects. int64 fields (id / *At timestamps) arrive as STRING for precision
 * past 2^53 (see fix-int64.js), so formatTimestamp parses before formatting.
 */

export const MESSAGE_STATUS_VALUE_ENUM = {
  MESSAGE_STATUS_UNSPECIFIED: { text: "全部" },
  MESSAGE_STATUS_PENDING: { text: "待发送" },
  MESSAGE_STATUS_SENT: { text: "已发送" },
  MESSAGE_STATUS_FAILED: { text: "失败" },
};

export const EMAIL_VENDOR_VALUE_ENUM = {
  EMAIL_VENDOR_UNSPECIFIED: { text: "全部" },
  EMAIL_VENDOR_ALIYUN: { text: "阿里云" },
  EMAIL_VENDOR_TENCENT: { text: "腾讯云" },
  EMAIL_VENDOR_NETEASE: { text: "网易" },
};

export const SMS_VENDOR_VALUE_ENUM = {
  SMS_VENDOR_UNSPECIFIED: { text: "全部" },
  SMS_VENDOR_ALIYUN: { text: "阿里云" },
  SMS_VENDOR_TENCENT: { text: "腾讯云" },
  SMS_VENDOR_VOLCENGINE: { text: "火山引擎" },
  SMS_VENDOR_BYTEPLUS: { text: "Byteplus" },
  SMS_VENDOR_HUAWEI: { text: "华为云" },
};

export const EMAIL_SCENE_VALUE_ENUM = {
  EMAIL_SCENE_UNSPECIFIED: { text: "全部" },
  EMAIL_SCENE_LOGIN_CODE: { text: "登录验证码" },
  EMAIL_SCENE_FORGOT_PASSWORD: { text: "找回密码" },
  EMAIL_SCENE_REGISTER: { text: "注册" },
  EMAIL_SCENE_CHANGE_PASSWORD: { text: "修改密码" },
  EMAIL_SCENE_BIND_ACCOUNT: { text: "绑定账号" },
  EMAIL_SCENE_NOTIFICATION: { text: "通知" },
  EMAIL_SCENE_VERIFY_EMAIL: { text: "验证邮箱" },
  EMAIL_SCENE_TEST: { text: "控制台测试" },
};

export const SMS_SCENE_VALUE_ENUM = {
  SMS_SCENE_UNSPECIFIED: { text: "全部" },
  SMS_SCENE_LOGIN_CODE: { text: "登录验证码" },
  SMS_SCENE_FORGOT_PASSWORD: { text: "找回密码" },
  SMS_SCENE_REGISTER: { text: "注册" },
  SMS_SCENE_CHANGE_PASSWORD: { text: "修改密码" },
  SMS_SCENE_BIND_ACCOUNT: { text: "绑定账号" },
  SMS_SCENE_VERIFY_PHONE: { text: "验证手机" },
  SMS_SCENE_TEST: { text: "控制台测试" },
};

/** Options for ProFormSelect (vendor dropdowns on the send forms). */
export const EMAIL_VENDOR_OPTIONS = [
  { label: "默认（自动）", value: "EMAIL_VENDOR_UNSPECIFIED" },
  { label: "阿里云", value: "EMAIL_VENDOR_ALIYUN" },
  { label: "腾讯云", value: "EMAIL_VENDOR_TENCENT" },
  { label: "网易", value: "EMAIL_VENDOR_NETEASE" },
];

export const SMS_VENDOR_OPTIONS = [
  { label: "默认（按区号路由）", value: "SMS_VENDOR_UNSPECIFIED" },
  { label: "阿里云", value: "SMS_VENDOR_ALIYUN" },
  { label: "腾讯云", value: "SMS_VENDOR_TENCENT" },
  { label: "火山引擎", value: "SMS_VENDOR_VOLCENGINE" },
  { label: "Byteplus", value: "SMS_VENDOR_BYTEPLUS" },
  { label: "华为云", value: "SMS_VENDOR_HUAWEI" },
];

/** Options for ProFormSelect (scene dropdowns on the send forms). */
export const EMAIL_SCENE_OPTIONS = [
  { label: "登录验证码", value: "EMAIL_SCENE_LOGIN_CODE" },
  { label: "找回密码", value: "EMAIL_SCENE_FORGOT_PASSWORD" },
  { label: "注册", value: "EMAIL_SCENE_REGISTER" },
  { label: "修改密码", value: "EMAIL_SCENE_CHANGE_PASSWORD" },
  { label: "绑定账号", value: "EMAIL_SCENE_BIND_ACCOUNT" },
  { label: "通知", value: "EMAIL_SCENE_NOTIFICATION" },
  { label: "验证邮箱", value: "EMAIL_SCENE_VERIFY_EMAIL" },
  { label: "控制台测试", value: "EMAIL_SCENE_TEST" },
];

export const SMS_SCENE_OPTIONS = [
  { label: "登录验证码", value: "SMS_SCENE_LOGIN_CODE" },
  { label: "找回密码", value: "SMS_SCENE_FORGOT_PASSWORD" },
  { label: "注册", value: "SMS_SCENE_REGISTER" },
  { label: "修改密码", value: "SMS_SCENE_CHANGE_PASSWORD" },
  { label: "绑定账号", value: "SMS_SCENE_BIND_ACCOUNT" },
  { label: "验证手机", value: "SMS_SCENE_VERIFY_PHONE" },
  { label: "控制台测试", value: "SMS_SCENE_TEST" },
];

const STATUS_COLOR: Record<string, string> = {
  MESSAGE_STATUS_PENDING: "orange",
  MESSAGE_STATUS_SENT: "green",
  MESSAGE_STATUS_FAILED: "red",
};

/** Delivery-status tag. */
export function MessageStatusTag({ status }: { status?: string }) {
  if (!status || status === "MESSAGE_STATUS_UNSPECIFIED") {
    return <span>-</span>;
  }
  const entry = MESSAGE_STATUS_VALUE_ENUM[status as keyof typeof MESSAGE_STATUS_VALUE_ENUM];
  return (
    <Tag color={STATUS_COLOR[status] ?? "default"}>{entry?.text ?? status}</Tag>
  );
}

/**
 * Format a proto3-JSON int64 timestamp (generated as STRING for precision past
 * 2^53) as a localized date string. Returns '-' for empty/0/invalid values.
 */
export function formatTimestamp(ts?: string | number): string {
  if (ts === undefined || ts === null || ts === "") return "-";
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return new Date(n).toLocaleString();
}
