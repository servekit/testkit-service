import { defineConfig } from '@umijs/max';
import { join } from 'path';

/**
 * testkit-service frontend (Umi Max 4 + antd 6 + ProComponents).
 *
 * Feature flags (each `{}` enables a built-in Umi Max plugin):
 *   antd / access / request / initialState / model / layout
 * `openAPI` is consumed by `npm run openapi` (= `max openapi` via
 * @umijs/max-plugin-openapi) to generate src/services/testkit/*.
 */
export default defineConfig({
  // openapi codegen config — consumed by `npm run openapi` (= swagger2openapi
  // + fix-int64 + max openapi) to generate src/services/testkit/*.
  openAPI: {
    // swagger2openapi converts backend Swagger 2.0 -> OpenAPI 3.0 into this file
    // (see the `openapi` npm script), then max openapi generates TS from it.
    schemaPath: join(__dirname, 'openapi.json'),
    requestLibPath: "import { request } from '@umijs/max'",
    // generate services under src/services/<projectName>/
    projectName: 'testkit',
    mock: false,
  },

  routes: [
    // Public auth surface (no ProLayout chrome).
    {
      path: '/user',
      layout: false,
      routes: [{ path: '/user/login', component: './User/Login' }],
    },
    // Internal back-office landing (dashboard) + P2-P5 domain placeholders.
    // All gated by `canInternal` (UserType = USER_TYPE_INTERNAL).
    {
      path: '/dashboard',
      name: '工作台',
      icon: 'DashboardOutlined',
      access: 'canInternal',
      component: './Dashboard',
    },
    {
      path: '/users',
      name: '用户',
      icon: 'TeamOutlined',
      access: 'canInternal',
      component: './Placeholder',
    },
    {
      path: '/files',
      name: '文件',
      icon: 'FileOutlined',
      access: 'canInternal',
      component: './Placeholder',
    },
    {
      path: '/messages',
      name: '消息',
      icon: 'MessageOutlined',
      access: 'canInternal',
      component: './Placeholder',
    },
    {
      path: '/gid',
      name: 'gid',
      icon: 'NumberOutlined',
      access: 'canInternal',
      component: './Placeholder',
    },
    {
      path: '/system',
      name: '系统',
      icon: 'SettingOutlined',
      access: 'canInternal',
      component: './Placeholder',
    },
    // Self-service landing (profile) — any logged-in user, incl. internal.
    {
      path: '/profile',
      name: '个人中心',
      icon: 'UserOutlined',
      access: 'canUser',
      component: './Profile',
    },
    { path: '/', redirect: '/profile' },
    { path: '*', layout: false, component: './404' },
  ],

  npmClient: 'npm',

  title: 'Testkit',

  hash: true,
  history: { type: 'browser' },
  // Wrap each async chunk in an IIFE so esbuild-minified helper names don't
  // collide across chunks (umi's esbuildHelperChecker enforces this).
  esbuildMinifyIIFE: true,
  layout: {
    title: 'Testkit',
    locale: false,
  },
  access: {},
  request: {},
  initialState: {},
  model: {},
  antd: {},

  proxy: {
    // dev-only: forward /api to the local gateway so the browser hits :18085.
    '/api/': {
      target: 'http://localhost:18085',
      changeOrigin: true,
    },
    '/ping': {
      target: 'http://localhost:18085',
      changeOrigin: true,
    },
  },

  // Prod build is served by nginx which proxies /api to testkit-service, so the
  // SPA does not need a base path.
  publicPath: '/',
});
