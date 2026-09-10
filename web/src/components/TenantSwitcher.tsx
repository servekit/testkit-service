/**
 * 顶栏租户切换器（tenant platform spec §5.3）——挂在 ProLayout actionsRender。
 *
 * - TENANT_ADMIN 多绑定：绑定集下拉（WhoAmI 引导结果）；单绑定自动选中，不渲染
 *   切换器；零绑定（被全员解绑）显示警示标签，管理面请求会被门 403。
 * - PLATFORM：跨租户标记（未选择时）+ 租户注册表下拉（ListTenants）——选择即
 *   下钻视图，选「跨租户（全部）」即回到不带 choice 的跨视图。
 * - END_USER：无管理面，不渲染。
 *
 * 切换 = 写本地 choice + 整页刷新：getInitialState 在新 choice 下重跑、各页面
 * 重新取数；会话（Bearer token）不动 —— 切换租户不换会话、不重登录。choice 由
 * 全局请求拦截器（src/request.ts）以 x-tenant-choice 头携带，网关剥除并转换
 * 为可信 x-tenant-key。
 */
import { useModel } from "@umijs/max";
import { Select, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { portalListTenants } from "@/services/testkit/testkitService";
import {
  clearTenantChoice,
  readTenantChoice,
  writeTenantChoice,
} from "@/utils/tenantChoice";

const USER_TYPE_PLATFORM = "USER_TYPE_PLATFORM";
const USER_TYPE_TENANT_ADMIN = "USER_TYPE_TENANT_ADMIN";

/** PLATFORM 下拉里「不指定租户」的哨兵值（存储层用 "" 表示）。 */
const CROSS_VIEW = "__cross_view__";

function tenantLabel(name?: string, key?: string): string {
  return name ? `${name}（${key ?? ""}）` : (key ?? "");
}

export function TenantSwitcher() {
  const { initialState } = useModel("@@initialState");
  const userType = initialState?.currentUser?.userType;

  // PLATFORM 的注册表下拉懒加载一次（低基数，无分页）。END_USER/TENANT_ADMIN
  // 不会用到，effect 内按角色短路。
  const [tenants, setTenants] = useState<API.TenantInfo[]>([]);
  const [, setChoiceRev] = useState(0);
  useEffect(() => {
    if (userType !== USER_TYPE_PLATFORM) return;
    let alive = true;
    portalListTenants()
      .then((resp) => {
        if (!alive) return;
        const list = resp.tenants ?? [];
        // 注册表里已不存在的存量 choice（租户被删）就地回落跨视图，避免后续
        // 请求携带一个会被网关 403 的 choice。
        const stored = readTenantChoice();
        if (stored && !list.some((t) => t.tenantKey === stored)) {
          clearTenantChoice();
          setChoiceRev((n) => n + 1);
        }
        setTenants(list);
      })
      .catch(() => {
        // 注册表加载失败：下拉保持空，drill-down 暂不可用；跨视图不受影响。
      });
    return () => {
      alive = false;
    };
  }, [userType]);

  // 切换 = 持久化 choice + 整页刷新（会话不动，见文件头注释）。
  const applyChoice = (key: string) => {
    writeTenantChoice(key);
    window.location.reload();
  };

  const choice = readTenantChoice();

  const tenantOptions = useMemo(
    () =>
      tenants
        .filter((t) => !!t.tenantKey)
        .map((t) => ({
          value: t.tenantKey as string,
          label: tenantLabel(t.name, t.tenantKey),
        })),
    [tenants],
  );

  if (userType === USER_TYPE_TENANT_ADMIN) {
    const memberships = initialState?.tenantMemberships ?? [];
    if (memberships.length === 0) {
      return <Tag color="red">未绑定租户</Tag>;
    }
    if (memberships.length === 1) {
      // 单绑定：门侧自动默认，无需切换器。
      return null;
    }
    return (
      <Select
        size="small"
        style={{ minWidth: 200 }}
        popupMatchSelectWidth={false}
        value={choice || undefined}
        placeholder="选择租户"
        onChange={applyChoice}
        options={memberships.map((m) => ({
          value: m.tenantKey ?? "",
          label: tenantLabel(m.tenantName, m.tenantKey),
        }))}
      />
    );
  }

  if (userType === USER_TYPE_PLATFORM) {
    return (
      <>
        {!choice && <Tag color="gold">跨租户视图</Tag>}
        <Select
          size="small"
          style={{ minWidth: 200 }}
          popupMatchSelectWidth={false}
          value={choice || CROSS_VIEW}
          onChange={(v) => applyChoice(v === CROSS_VIEW ? "" : v)}
          options={[
            { value: CROSS_VIEW, label: "跨租户（全部）" },
            ...tenantOptions,
          ]}
        />
      </>
    );
  }

  return null;
}
