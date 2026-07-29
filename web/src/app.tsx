import type { RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { App as AntdApp } from 'antd';
import type { ReactNode } from 'react';
import { requestConfig } from './request';

const LOGIN_PATH = '/user/login';

function readUser(): API.User | undefined {
  try {
    const raw = localStorage.getItem('testkit_user');
    return raw ? (JSON.parse(raw) as API.User) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Initial state consumed by the layout (avatar / menu). Refreshed on login,
 * logout, and on every full app mount. Kept intentionally minimal — ProLayout
 * reads currentUser to render the user chip.
 */
export async function getInitialState(): Promise<{
  currentUser?: API.User;
}> {
  return { currentUser: readUser() };
}

/** Auth gate: bounce to /user/login when there is no session. */
export function render(oldRender: () => void) {
  const token = localStorage.getItem('testkit_token');
  const onLogin = window.location.pathname.startsWith(LOGIN_PATH);
  if (!token && !onLogin) {
    history.push(LOGIN_PATH);
  }
  oldRender();
}

/** Re-export the request config so Umi Max wires the Bearer interceptor + 401 handler. */
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
 * 消息/gid/系统 + 个人中心); access-gated via src/access.ts. Real pages arrive P2-P5.
 */
export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  const user = initialState?.currentUser;
  return {
    title: 'Testkit',
    logo: false,
    menu: { locale: false },
    avatarProps: {
      size: 'small',
      title: user?.nickname || user?.username || '用户',
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
