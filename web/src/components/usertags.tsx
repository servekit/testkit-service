import { Tag } from "antd";

/**
 * Shared label/tag renderers for the P2 user-domain enums.
 *
 * Kept in one place because user_type / status / gender tags are rendered
 * identically across the profile, user-list, and RBAC pages. Enums are the
 * proto string-union values generated into API.v1* (int mirrors downstream).
 */

const USER_TYPE_INTERNAL = "USER_TYPE_INTERNAL";

/** Read-only account-type tag (internal vs external per design spec §3.5). */
export function UserTypeTag({ userType }: { userType?: string }) {
  const internal = userType === USER_TYPE_INTERNAL;
  return (
    <Tag color={internal ? "gold" : "blue"}>{internal ? "内部" : "外部"}</Tag>
  );
}

/** User status tag (active / disabled / pending). */
export function UserStatusTag({ status }: { status?: string }) {
  switch (status) {
    case "USER_STATUS_ACTIVE":
      return <Tag color="green">正常</Tag>;
    case "USER_STATUS_DISABLED":
      return <Tag color="red">禁用</Tag>;
    case "USER_STATUS_PENDING_REVIEW":
      return <Tag color="orange">待激活</Tag>;
    default:
      return <span>-</span>;
  }
}

export const GENDER_VALUE_ENUM = {
  GENDER_UNSPECIFIED: { text: "未设置" },
  GENDER_MALE: { text: "男" },
  GENDER_FEMALE: { text: "女" },
  GENDER_OTHER: { text: "其他" },
  GENDER_UNKNOWN: { text: "保密" },
};

export const USER_STATUS_VALUE_ENUM = {
  USER_STATUS_UNSPECIFIED: { text: "全部" },
  USER_STATUS_ACTIVE: { text: "正常" },
  USER_STATUS_DISABLED: { text: "禁用" },
  USER_STATUS_PENDING_REVIEW: { text: "待激活" },
};

export const USER_TYPE_VALUE_ENUM = {
  USER_TYPE_UNSPECIFIED: { text: "全部" },
  USER_TYPE_NORMAL: { text: "外部" },
  USER_TYPE_INTERNAL: { text: "内部" },
};

export const PROVIDER_VALUE_ENUM = {
  IDENTITY_PROVIDER_UNSPECIFIED: { text: "未设置" },
  IDENTITY_PROVIDER_EMAIL: { text: "邮箱" },
  IDENTITY_PROVIDER_PHONE: { text: "手机" },
  IDENTITY_PROVIDER_GITHUB: { text: "GitHub" },
  IDENTITY_PROVIDER_GOOGLE: { text: "Google" },
  IDENTITY_PROVIDER_WECHAT: { text: "微信" },
  IDENTITY_PROVIDER_APPLE: { text: "Apple" },
  IDENTITY_PROVIDER_WECHAT_MINIPROGRAM: { text: "微信小程序" },
  IDENTITY_PROVIDER_ADMIN: { text: "管理员创建" },
};

export const DEVICE_TYPE_VALUE_ENUM = {
  DEVICE_TYPE_UNSPECIFIED: { text: "未知" },
  DEVICE_TYPE_WEB: { text: "Web" },
  DEVICE_TYPE_IOS: { text: "iOS" },
  DEVICE_TYPE_ANDROID: { text: "Android" },
  DEVICE_TYPE_API: { text: "API" },
};

export const LOGIN_ACTION_VALUE_ENUM = {
  LOGIN_ACTION_UNSPECIFIED: { text: "未知" },
  LOGIN_ACTION_LOGIN: { text: "登录" },
  LOGIN_ACTION_REGISTER: { text: "注册" },
  LOGIN_ACTION_SOCIAL_LOGIN: { text: "社交登录" },
  LOGIN_ACTION_SOCIAL_REGISTER: { text: "社交注册" },
  LOGIN_ACTION_BIND: { text: "绑定" },
  LOGIN_ACTION_UNBIND: { text: "解绑" },
};

export const SESSION_STATUS_VALUE_ENUM = {
  SESSION_STATUS_UNSPECIFIED: { text: "未知" },
  SESSION_STATUS_ACTIVE: { text: "活跃" },
  SESSION_STATUS_REVOKED: { text: "已登出" },
  SESSION_STATUS_EXPIRED: { text: "已失效" },
};

export const LOGIN_METHOD_VALUE_ENUM = {
  LOGIN_METHOD_UNSPECIFIED: { text: "-" },
  LOGIN_METHOD_EMAIL_PASSWORD: { text: "邮箱密码" },
  LOGIN_METHOD_PHONE_PASSWORD: { text: "手机密码" },
  LOGIN_METHOD_PHONE_CODE: { text: "手机验证码" },
  LOGIN_METHOD_EMAIL_CODE: { text: "邮箱验证码" },
  LOGIN_METHOD_USERNAME_PASSWORD: { text: "账号密码" },
};

/**
 * Session rows store LOGIN_METHOD_* for credential logins but
 * IDENTITY_PROVIDER_* for social/mini-program ones — one lookup for both.
 */
export function loginMethodLabel(v?: string): string {
  if (!v) return "-";
  return (
    LOGIN_METHOD_VALUE_ENUM[v]?.text ??
    PROVIDER_VALUE_ENUM[v]?.text ??
    v
  );
}
