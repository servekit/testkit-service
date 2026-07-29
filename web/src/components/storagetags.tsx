import { Tag } from "antd";

/**
 * Shared label/tag renderers + ProTable valueEnums for the P3 storage-domain
 * enums.
 *
 * Mirrors usertags.tsx: enum values are the proto string-union values generated
 * into API.v1* (which mirror storage-service by name+number). UNSPECIFIED is
 * mapped to "全部" so it reads as "no filter" in ProTable search selects.
 */

export const OWNER_TYPE_VALUE_ENUM = {
  OWNER_TYPE_UNSPECIFIED: { text: "全部" },
  OWNER_TYPE_USER: { text: "用户" },
  OWNER_TYPE_SYSTEM: { text: "系统" },
  OWNER_TYPE_GROUP: { text: "用户组" },
  OWNER_TYPE_BUSINESS: { text: "业务" },
  OWNER_TYPE_SERVICE: { text: "服务" },
};

export const VENDOR_VALUE_ENUM = {
  VENDOR_UNSPECIFIED: { text: "全部" },
  VENDOR_ALIYUN_OSS: { text: "阿里云 OSS" },
  VENDOR_AWS_S3: { text: "AWS S3" },
  VENDOR_S3_COMPATIBLE: { text: "S3 兼容" },
  VENDOR_TENCENT_COS: { text: "腾讯云 COS" },
  VENDOR_HUAWEI_OBS: { text: "华为云 OBS" },
  VENDOR_VOLCENGINE_TOS: { text: "火山引擎 TOS" },
};

export const BUCKET_ACL_VALUE_ENUM = {
  BUCKET_ACL_UNSPECIFIED: { text: "未设置" },
  BUCKET_ACL_PRIVATE: { text: "私有" },
  BUCKET_ACL_PUBLIC_READ: { text: "公共读" },
  BUCKET_ACL_PUBLIC_READ_WRITE: { text: "公共读写" },
};

export const AUDIT_STATUS_VALUE_ENUM = {
  AUDIT_LOG_STATUS_UNSPECIFIED: { text: "全部" },
  AUDIT_LOG_STATUS_SUCCESS: { text: "成功" },
  AUDIT_LOG_STATUS_FAILED: { text: "失败" },
};

export const AUDIT_TARGET_TYPE_VALUE_ENUM = {
  AUDIT_LOG_TARGET_TYPE_UNSPECIFIED: { text: "全部" },
  AUDIT_LOG_TARGET_TYPE_FILE: { text: "文件" },
  AUDIT_LOG_TARGET_TYPE_QUOTA: { text: "配额" },
  AUDIT_LOG_TARGET_TYPE_OWNER: { text: "Owner" },
};

export const AUDIT_ACTION_VALUE_ENUM = {
  AUDIT_ACTION_UNSPECIFIED: { text: "全部" },
  AUDIT_ACTION_UPLOAD: { text: "上传" },
  AUDIT_ACTION_UPDATE: { text: "更新" },
  AUDIT_ACTION_DELETE: { text: "删除" },
  AUDIT_ACTION_BATCH_DELETE: { text: "批量删除" },
  AUDIT_ACTION_ADMIN_DELETE: { text: "管理员删除" },
  AUDIT_ACTION_ADMIN_SET_QUOTA: { text: "管理员设配额" },
  AUDIT_ACTION_ADMIN_SOFT_DELETE_OWNER: { text: "管理员软删 Owner 文件" },
  AUDIT_ACTION_ADMIN_DELETE_OWNER: { text: "管理员删除 Owner" },
  AUDIT_ACTION_SET_OWNER_QUOTA: { text: "设置 Owner 配额" },
  AUDIT_ACTION_ADD_OWNER_QUOTA: { text: "调整 Owner 配额" },
  AUDIT_ACTION_UPLOAD_SESSION_CREATE: { text: "上传会话创建" },
  AUDIT_ACTION_UPLOAD_SESSION_CONFIRM: { text: "上传会话确认" },
  AUDIT_ACTION_UPLOAD_SESSION_CANCEL: { text: "上传会话取消" },
  AUDIT_ACTION_UPLOAD_SESSION_GC: { text: "上传会话回收" },
};

export const SORT_FIELD_VALUE_ENUM = {
  SORT_FIELD_UNSPECIFIED: { text: "默认" },
  SORT_FIELD_CREATED_AT: { text: "创建时间" },
  SORT_FIELD_FILENAME: { text: "文件名" },
  SORT_FIELD_SIZE: { text: "大小" },
};

/** Audit outcome tag. */
export function AuditStatusTag({ status }: { status?: string }) {
  switch (status) {
    case "AUDIT_LOG_STATUS_SUCCESS":
      return <Tag color="green">成功</Tag>;
    case "AUDIT_LOG_STATUS_FAILED":
      return <Tag color="red">失败</Tag>;
    default:
      return <span>-</span>;
  }
}

/** Render an audit action as its localized label (falls back to the raw value). */
export function auditActionLabel(action?: string): string {
  if (!action) return "-";
  const entry = AUDIT_ACTION_VALUE_ENUM[action as keyof typeof AUDIT_ACTION_VALUE_ENUM];
  return entry?.text ?? action;
}

/**
 * Format an int64-byte field (generated as string for precision past 2^53) as a
 * human-readable size. proto3 JSON serializes int64 as a STRING; all byte/size
 * fields in the storage types arrive as string, so parse before formatting.
 */
export function formatBytes(bytes?: string | number): string {
  const n = typeof bytes === "number" ? bytes : Number(bytes ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(n) / Math.log(1024)),
  );
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
