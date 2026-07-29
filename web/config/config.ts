import { defineConfig } from "@umijs/max";
import { join } from "path";

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
    schemaPath: join(__dirname, "openapi.json"),
    requestLibPath: "import { request } from '@umijs/max'",
    // generate services under src/services/<projectName>/
    projectName: "testkit",
    mock: false,
  },

  routes: [
    // Public auth surface (no ProLayout chrome).
    {
      path: "/user",
      layout: false,
      routes: [{ path: "/user/login", component: "./User/Login" }],
    },
    // --- Self-service (any logged-in user, incl. internal) → access: canUser ---
    {
      path: "/profile",
      name: "个人资料",
      icon: "UserOutlined",
      access: "canUser",
      component: "./Profile",
    },
    {
      path: "/identity",
      name: "登录方式",
      icon: "SafetyCertificateOutlined",
      access: "canUser",
      component: "./Identity",
    },
    {
      path: "/sessions",
      name: "会话管理",
      icon: "DesktopOutlined",
      access: "canUser",
      component: "./Session",
    },
    // --- Self-service storage (any logged-in user) → access: canUser ---
    {
      path: "/files",
      name: "我的文件",
      icon: "FileOutlined",
      access: "canUser",
      routes: [
        { path: "/files", redirect: "/files/my" },
        { path: "/files/my", name: "文件列表", component: "./Files/MyFiles" },
      ],
    },
    {
      path: "/storage",
      name: "我的存储",
      icon: "CloudServerOutlined",
      access: "canUser",
      routes: [
        { path: "/storage", redirect: "/storage/quota" },
        {
          path: "/storage/quota",
          name: "我的配额",
          component: "./Storage/Quota",
        },
        {
          path: "/storage/audit",
          name: "操作审计",
          component: "./Storage/Audit",
        },
      ],
    },
    // --- Internal back-office → access: canInternal (UserType = INTERNAL) ---
    {
      path: "/dashboard",
      name: "工作台",
      icon: "DashboardOutlined",
      access: "canInternal",
      component: "./Dashboard",
    },
    {
      path: "/users",
      name: "用户运营",
      icon: "TeamOutlined",
      access: "canInternal",
      routes: [
        {
          path: "/users",
          redirect: "/users/list",
        },
        {
          path: "/users/list",
          name: "用户列表",
          component: "./User/List",
        },
        {
          path: "/users/login-logs",
          name: "登录日志",
          component: "./User/LoginLogs",
        },
      ],
    },
    {
      path: "/rbac",
      name: "权限管理",
      icon: "KeyOutlined",
      access: "canInternal",
      routes: [
        {
          path: "/rbac",
          redirect: "/rbac/roles",
        },
        {
          path: "/rbac/roles",
          name: "角色",
          component: "./Rbac/Roles",
        },
        {
          path: "/rbac/groups",
          name: "用户组",
          component: "./Rbac/Groups",
        },
        {
          path: "/rbac/permissions",
          name: "权限",
          component: "./Rbac/Permissions",
        },
        {
          path: "/rbac/permission-groups",
          name: "权限组",
          component: "./Rbac/PermissionGroups",
        },
        {
          path: "/rbac/user-roles",
          name: "用户角色",
          component: "./Rbac/UserRoles",
        },
      ],
    },
    {
      path: "/admin/storage",
      name: "存储管理",
      icon: "CloudUploadOutlined",
      access: "canInternal",
      routes: [
        { path: "/admin/storage", redirect: "/admin/storage/files" },
        {
          path: "/admin/storage/files",
          name: "文件",
          component: "./Admin/Storage/Files",
        },
        {
          path: "/admin/storage/quota",
          name: "配额",
          component: "./Admin/Storage/Quota",
        },
        {
          path: "/admin/storage/stats",
          name: "统计",
          component: "./Admin/Storage/Stats",
        },
        {
          path: "/admin/storage/providers",
          name: "Providers",
          component: "./Admin/Storage/Providers",
        },
        {
          path: "/admin/storage/buckets",
          name: "Buckets",
          component: "./Admin/Storage/Buckets",
        },
      ],
    },
    {
      path: "/admin/audit-logs",
      name: "审计日志",
      icon: "AuditOutlined",
      access: "canInternal",
      component: "./Admin/Audit",
    },
    // --- Future-phase placeholders (P4–P6) ---
    {
      path: "/messages",
      name: "消息",
      icon: "MessageOutlined",
      access: "canInternal",
      component: "./Placeholder",
    },
    {
      path: "/gid",
      name: "gid",
      icon: "NumberOutlined",
      access: "canInternal",
      component: "./Placeholder",
    },
    {
      path: "/system",
      name: "系统",
      icon: "SettingOutlined",
      access: "canInternal",
      component: "./Placeholder",
    },
    { path: "/", redirect: "/profile" },
    { path: "*", layout: false, component: "./404" },
  ],

  npmClient: "npm",

  title: "Testkit",

  hash: true,
  history: { type: "browser" },
  // Wrap each async chunk in an IIFE so esbuild-minified helper names don't
  // collide across chunks (umi's esbuildHelperChecker enforces this).
  esbuildMinifyIIFE: true,
  layout: {
    title: "Testkit",
    locale: false,
  },
  access: {},
  request: {},
  initialState: {},
  model: {},
  antd: {},

  proxy: {
    // dev-only: forward /api to the local gateway so the browser hits :18085.
    "/api/": {
      target: "http://localhost:18085",
      changeOrigin: true,
    },
    "/ping": {
      target: "http://localhost:18085",
      changeOrigin: true,
    },
  },

  // Prod build is served by nginx which proxies /api to testkit-service, so the
  // SPA does not need a base path.
  publicPath: "/",
});
