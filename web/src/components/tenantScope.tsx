import { useModel } from "@umijs/max";
import { Select, Tag } from "antd";
import { readTenantChoice } from "@/utils/tenantChoice";

/**
 * 租户视图模型 + 归属徽标/筛选器（tenant platform phase ④ T4）。
 *
 * ③期资源域把消息资源分成两层：平台池（tenant_key NULL，全体租户可用）与
 * 租户私有（tenant_key = 某租户）。本模块给各管理页一套统一的呈现规则：
 *
 * - 租户视图（顶栏切换器选中某租户——TENANT_ADMIN 固定，PLATFORM 下钻）：
 *   平台池行标「平台共享」、本租户私有行标「本租户」；其他租户的私有行
 *   不展示（管理面按注入租户键自服务的可见边界）。平台池行的启停/删除/
 *   编辑对租户管理员隐藏（共享基础设施归平台管）。
 * - 跨租户视图（PLATFORM 未选租户）：全量行 + 租户列/筛选器（数据取各行
 *   的 tenant_key 字段——③期 proto 已回显）。
 *
 * 后端管理面 RPC 不分视角全量返回（平台信任姿态，门在 testkit），所以
 * 租户视图的行过滤在控制台侧完成；创建对话框的「租户视图默认私有」由
 * 各页用 view.tenantKey 作归属下拉的 initialValue 实现。
 *
 * 与 TenantSwitcher 的关系：choice 变更 = 整页刷新，所以各页只需在挂载时
 * 读一次（readTenantChoice），刷新后自然重算。
 */

const USER_TYPE_PLATFORM = "USER_TYPE_PLATFORM";

/** 跨租户筛选器哨兵值（存储层/行上没有对应值，仅前端筛选用）。 */
export const TENANT_FILTER_ALL = "__all__";
export const TENANT_FILTER_POOL = "__platform_pool__";

/** 一行资源相对当前视图的归属。 */
export type TenantScope = "platform" | "own" | "other";

export interface TenantView {
  /** 当前操作身份的租户键；"" = 跨租户视图（PLATFORM 未选）或未定（零绑定）。 */
  tenantKey: string;
  /** PLATFORM 跨租户视图（看到全量行 + 租户列/筛选器）。 */
  crossView: boolean;
  /** USER_TYPE_PLATFORM（平台员工，任何行都可管理）。 */
  isPlatform: boolean;
  /** 行归属分类。 */
  scopeOf: (rowTenantKey?: string) => TenantScope;
  /** 当前身分能否启停/删除/编辑该行：平台员工全可；租户管理员仅本租户私有行。 */
  canManage: (rowTenantKey?: string) => boolean;
}

/**
 * 当前租户视图。租户键来自切换器的本地 choice（"" 且 PLATFORM = 跨视图）；
 * userType 来自 initialState（session），与 access.ts 同源。
 */
export function useTenantView(): TenantView {
  const { initialState } = useModel("@@initialState");
  const isPlatform = initialState?.currentUser?.userType === USER_TYPE_PLATFORM;
  const tenantKey = readTenantChoice();
  const crossView = isPlatform && tenantKey === "";
  const scopeOf = (rowTenantKey?: string): TenantScope => {
    if (!rowTenantKey) return "platform";
    if (!crossView && rowTenantKey === tenantKey) return "own";
    return "other";
  };
  // 租户视图下平台池行只读（平台员工除外）；跨视图只有平台员工会到。
  const canManage = (rowTenantKey?: string) =>
    isPlatform || scopeOf(rowTenantKey) === "own";
  return { tenantKey, crossView, isPlatform, scopeOf, canManage };
}

/**
 * 归属列渲染：租户视图 → 平台共享/本租户徽标；跨视图 → 租户键（空 =
 * 平台池），配合 TenantFilterSelect 筛选器使用。
 */
export function renderTenantScope(
  view: TenantView,
  rowTenantKey?: string,
) {
  if (view.crossView) {
    return rowTenantKey ? (
      <Tag color="purple">{rowTenantKey}</Tag>
    ) : (
      <Tag>平台池</Tag>
    );
  }
  const scope = view.scopeOf(rowTenantKey);
  if (scope === "platform") return <Tag color="geekblue">平台共享</Tag>;
  if (scope === "own") return <Tag color="green">本租户</Tag>;
  // 租户视图不该出现 other 行（filterTenantRows 已滤除）——防御性兜底。
  return <Tag color="red">{rowTenantKey}</Tag>;
}

/** 租户视图的行过滤器：滤除其他租户的私有行；跨视图全量。 */
export function filterTenantRows<T>(
  view: TenantView,
  rows: T[],
  getKey: (row: T) => string | undefined,
): T[] {
  if (view.crossView) return rows;
  return rows.filter((r) => view.scopeOf(getKey(r)) !== "other");
}

/** 跨视图租户筛选器选项（从已加载行收集去重租户键）。 */
export function tenantFilterOptions<T>(
  rows: T[],
  getKey: (row: T) => string | undefined,
): { value: string; label: string }[] {
  const keys = Array.from(
    new Set(rows.map(getKey).filter((k): k is string => !!k)),
  ).sort();
  return [
    { value: TENANT_FILTER_ALL, label: "全部租户" },
    { value: TENANT_FILTER_POOL, label: "平台池" },
    ...keys.map((k) => ({ value: k, label: k })),
  ];
}

/** 跨视图租户筛选器应用（tenantFilterOptions 的逆操作）。 */
export function applyTenantFilter<T>(
  filter: string,
  rows: T[],
  getKey: (row: T) => string | undefined,
): T[] {
  if (filter === TENANT_FILTER_ALL) return rows;
  if (filter === TENANT_FILTER_POOL) return rows.filter((r) => !getKey(r));
  return rows.filter((r) => getKey(r) === filter);
}

/** 跨视图租户筛选下拉（toolBarRender 用，仅 crossView 渲染）。 */
export function TenantFilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select
      size="small"
      style={{ minWidth: 180 }}
      popupMatchSelectWidth={false}
      value={value}
      onChange={onChange}
      options={options}
    />
  );
}
