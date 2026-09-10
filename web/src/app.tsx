import type { RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { App as AntdApp, Dropdown } from 'antd';
import type { ReactNode } from 'react';
import { TenantSwitcher } from './components/TenantSwitcher';
import { requestConfig } from './request';
import { installChunkReloadGuard } from './utils/chunkGuard';
import { endSession } from './utils/session';
import { portalWhoAmI } from './services/testkit/testkitService';
import {
  clearTenantChoice,
  ensureTenantChoice,
  readTenantChoice,
} from './utils/tenantChoice';

// Before anything renders: a stale-deploy tab whose lazy chunks 404 should
// reload itself once instead of showing "Loading chunk ... failed" forever.
installChunkReloadGuard();

const LOGIN_PATH = '/user/login';
// Public (session-less) surfaces: everything under /user/ — login + register.
const PUBLIC_PREFIX = '/user/';

const USER_TYPE_TENANT_ADMIN = 'USER_TYPE_TENANT_ADMIN';

function readUser(): API.User | undefined {
  try {
    const raw = localStorage.getItem('testkit_user');
    return raw ? (JSON.parse(raw) as API.User) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Initial state consumed by the layout (avatar / menu / tenant switcher).
 * Refreshed on login, logout, and on every full app mount. Kept intentionally
 * minimal — ProLayout reads currentUser to render the user chip; the tenant
 * switcher reads tenantMemberships (TENANT_ADMIN binding set, §5.3).
 *
 * The switcher's bootstrap: right after login (or on any app mount with a
 * session) a TENANT_ADMIN's WhoAmI answers their binding set, and the stored
 * choice is validated against it (single binding auto-selects; multi-binding
 * defaults to the stored choice or the first binding). WhoAmI is the one
 * console route allowed through the door without a choice — exactly so this
 * bootstrap can run before the first choice exists. A WhoAmI 403 with a
 * stored choice means the choice went stale (e.g. the admin was unbound):
 * it is cleared and WhoAmI retried choice-less through that exemption path
 * before anything degrades. Remaining failures (portal down, revoked
 * bindings) degrade to an empty set: the switcher shows the no-tenant state
 * and management-plane calls surface their own errors.
 */
export async function getInitialState(): Promise<{
  currentUser?: API.User;
  tenantMemberships?: API.TenantMembership[];
}> {
  const currentUser = readUser();
  const token = localStorage.getItem('testkit_token');
  if (!currentUser || !token) {
    return {};
  }
  if (currentUser.userType !== USER_TYPE_TENANT_ADMIN) {
    // PLATFORM keeps whatever drill-down choice is stored (validated
    // server-side against the registry on every request); END_USER has no
    // management plane at all.
    return { currentUser };
  }
  try {
    const who = await portalWhoAmI();
    const memberships = who.memberships ?? [];
    ensureTenantChoice(memberships);
    return { currentUser, tenantMemberships: memberships };
  } catch (err) {
    // Stale-choice dead-end (T3 follow-up, the unbind scenario): the request
    // interceptor attaches x-tenant-choice to WhoAmI itself, so an admin
    // unbound from their stored tenant gets ErrChoiceNotBound → 403 on the
    // very call that should re-learn their binding set — and the blanket
    // catch below would strand them on the "未绑定租户" red tag even with
    // other live bindings. When the failure is a 403 WITH a stored choice,
    // drop the choice and retry WhoAmI with NO choice: the choiceless
    // bootstrap route crosses the door via its exemption path (single
    // binding defaults server-side) and answers the real binding set.
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    if (status === 403 && readTenantChoice() !== "") {
      clearTenantChoice();
      try {
        const who = await portalWhoAmI();
        const memberships = who.memberships ?? [];
        ensureTenantChoice(memberships);
        return { currentUser, tenantMemberships: memberships };
      } catch {
        // fall through to the degradation below
      }
    }
    // Bootstrap degradation — see the doc comment above (portal down, or
    // the binding set itself is empty: unbind-everything keeps the red tag).
    return { currentUser, tenantMemberships: [] };
  }
}

/** Auth gate: bounce to /user/login when there is no session. */
export function render(oldRender: () => void) {
  const token = localStorage.getItem('testkit_token');
  const isPublic = window.location.pathname.startsWith(PUBLIC_PREFIX);
  if (!token && !isPublic) {
    history.push(LOGIN_PATH);
  }
  oldRender();
}

/** Re-export the request config so Umi Max wires the Bearer + tenant-choice interceptors and the 401 handler. */
export const request = requestConfig;

/**
 * Wrap the app in antd's <App> so message/notification/modal static consumers
 * (App.useApp) have a context — the login route renders without ProLayout, so it
 * can't rely on a layout-provided App wrapper.
 */
export function rootContainer(container: ReactNode) {
  return <AntdApp>{container}</AntdApp>;
}

/**
 * ProLayout shell. Sidebar menu is derived from config routes (工作台/用户/文件/
 * 消息/gid/系统 + 个人中心 + 租户管理); access-gated via src/access.ts. The top
 * bar carries the tenant switcher (phase ④): membership dropdown for
 * multi-binding TENANT_ADMINs, cross-view badge + registry dropdown for
 * PLATFORM; single-binding admins and END_USERs render nothing.
 */
export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  const user = initialState?.currentUser;
  return {
    title: 'Testkit',
    logo: false,
    menu: { locale: false },
    actionsRender: () => [<TenantSwitcher key="tenant-switcher" />],
    avatarProps: {
      size: 'small',
      title: user?.nickname || user?.username || '用户',
      render: (_props, dom) => (
        <Dropdown
          menu={{
            items: [{ key: 'logout', label: '退出登录' }],
            onClick: ({ key }) => {
              if (key === 'logout') {
                void endSession();
              }
            },
          }}
        >
          {dom}
        </Dropdown>
      ),
    },
    onPageChange: () => {
      const token = localStorage.getItem('testkit_token');
      const onLogin = window.location.pathname.startsWith(LOGIN_PATH);
      if (!token && !onLogin) {
        history.push(LOGIN_PATH);
      }
    },
  };
};
