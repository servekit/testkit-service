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
      routes: [
        { path: "/user/login", component: "./User/Login" },
        { path: "/user/register", component: "./User/Register" },
      ],
    },
    // Anonymous file-link landing page — the token in the path is the
    // credential; recipients arrive from links embedded in sent emails.
    {
      path: "/link",
      layout: false,
      routes: [{ path: "/link/:token", component: "./Link/Download" }],
    },
    // --- Nav grouped one top-level menu item per embedded service (user /
    // storage / message / gid) plus testkit's own surfaces (dashboard / system).
    // Group parents are PATHLESS routes (no `path`) — umi/react-router require
    // a child's absolute path to be prefixed by its parent's path, so a pathed
    // parent like "/user-service" with child "/profile" breaks route creation.
    // A pathless parent only groups the MENU; matching behaves exactly as the
    // previous flat layout, so every leaf path/URL below is unchanged.
    // Access stays per leaf: self-service pages keep access: canUser,
    // back-office pages keep access: canInternal. Mixed parents (用户服务 /
    // 存储服务) gate on canUser so the submenu filters down to the
    // self-service pages for normal users; internal users see all. Nameless
    // redirect entries (e.g. /files → /files/my) never render in the menu.
    {
      path: "/dashboard",
      name: "仪表盘",
      icon: "DashboardOutlined",
      access: "canInternal",
      component: "./Dashboard",
    },
    // --- user-service: profile / identities / sessions + back-office ---
    // `key` is required on PATHLESS group parents: umi's menu transform
    // (route-utils transformRoute) derives a submenu's key from `item.key ||
    // path` — without a path every pathless parent degrades to the same shared
    // key (they expand/collapse together) and children get no parentKeys
    // (selecting a leaf freezes the other submenus).
    {
      key: "svc-user",
      name: "用户服务",
      icon: "TeamOutlined",
      access: "canUser",
      routes: [
        {
          path: "/profile",
          name: "个人资料",
          access: "canUser",
          component: "./Profile",
        },
        {
          path: "/identity",
          name: "登录方式",
          access: "canUser",
          component: "./Identity",
        },
        {
          path: "/sessions",
          name: "会话管理",
          access: "canUser",
          component: "./Session",
        },
        {
          path: "/users",
          name: "用户运营",
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
              name: "认证记录",
              component: "./User/LoginLogs",
            },
          ],
        },
        {
          path: "/rbac",
          name: "权限管理",
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
      ],
    },
    // --- storage-service: my files/quota + admin console + audit ---
    // `key` on this pathless parent — see the svc-user comment above.
    {
      key: "svc-storage",
      name: "存储服务",
      icon: "CloudServerOutlined",
      access: "canUser",
      routes: [
        { path: "/files", redirect: "/files/my" },
        {
          path: "/files/my",
          name: "我的文件",
          access: "canUser",
          component: "./Files/MyFiles",
        },
        {
          path: "/storage",
          name: "我的存储",
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
        {
          path: "/admin/storage",
          name: "存储管理",
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
          access: "canInternal",
          component: "./Admin/Audit",
        },
      ],
    },
    // --- Message ops console (P4) → access: canInternal ---
    // Internal-only ops surface: ad-hoc send (email/SMS) + full-fidelity record
    // lists with stats. message = internal (per cross-plan decision); backend
    // does no RBAC this phase (design §3.5), the split is a frontend route guard.
    {
      path: "/message",
      name: "消息服务",
      icon: "MessageOutlined",
      access: "canInternal",
      routes: [
        { path: "/message", redirect: "/message/send/email" },
        {
          path: "/message/send/email",
          name: "发送邮件",
          component: "./Message/SendEmail",
        },
        {
          path: "/message/send/sms",
          name: "发送短信",
          component: "./Message/SendSMS",
        },
        {
          path: "/message/emails",
          name: "邮件记录",
          component: "./Message/Emails",
        },
        {
          path: "/message/sms",
          name: "短信记录",
          component: "./Message/SMS",
        },
      ],
    },
    // --- GID debug (P5) → access: canInternal ---
    // Internal-only snowflake ID debug tool: generate single/batch + decompose
    // an ID into time/sequence/machine_id. gid RPCs are authenticated; the split
    // is a frontend route guard (design §3.5).
    {
      path: "/gid",
      name: "GID 服务",
      icon: "NumberOutlined",
      access: "canInternal",
      component: "./Gid/Debug",
    },
    // --- license-service (P6): key lifecycle + client activation surface ---
    {
      key: "svc-license",
      name: "License 服务",
      icon: "KeyOutlined",
      access: "canInternal",
      routes: [
        { path: "/license", redirect: "/license/keys" },
        {
          path: "/license/keys",
          name: "密钥管理",
          component: "./License/Keys",
        },
        {
          path: "/license/console",
          name: "客户端测试",
          component: "./License/Console",
        },
      ],
    },
    // --- telemetry-service (P6): app registry + stats ---
    {
      key: "svc-telemetry",
      name: "Telemetry 服务",
      icon: "MonitorOutlined",
      access: "canInternal",
      routes: [
        { path: "/telemetry", redirect: "/telemetry/apps" },
        {
          path: "/telemetry/apps",
          name: "应用管理",
          component: "./Telemetry/Apps",
        },
        {
          path: "/telemetry/stats",
          name: "应用统计",
          component: "./Telemetry/Stats",
        },
      ],
    },
    // --- reference-service (P7): global reference data console ---
    // Static directories (countries/timezones/languages/currencies/region
    // groups) + phone parse tool. Internal-only like the other debug
    // consoles; the pre-login register page keeps its own public endpoint.
    {
      key: "svc-reference",
      name: "Reference 服务",
      icon: "GlobalOutlined",
      access: "canInternal",
      routes: [
        { path: "/reference", redirect: "/reference/directory" },
        {
          path: "/reference/directory",
          name: "数据目录",
          component: "./Reference/Directory",
        },
        {
          path: "/reference/regions",
          name: "区域浏览",
          component: "./Reference/Regions",
        },
        {
          path: "/reference/defaults",
          name: "默认值填充",
          component: "./Reference/Defaults",
        },
        {
          path: "/reference/examples",
          name: "常用示例",
          component: "./Reference/Examples",
        },
        {
          path: "/reference/phone",
          name: "手机号解析",
          component: "./Reference/Phone",
        },
      ],
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
