import type { RequestConfig } from '@umijs/max';
import { TENANT_CHOICE_STORAGE_KEY } from './utils/tenantChoice';

/**
 * Umi Max request config (re-exported from src/app.tsx as `export const request`).
 *
 * Note on baseURL: the OpenAPI spec paths already include the `/api` prefix
 * (e.g. `/api/v1/auth/login`), so @umijs/openapi generates request URLs that
 * start with `/api/`. We therefore leave baseURL empty to avoid double-prefixing.
 * nginx proxies `/api/` (and `/ping`) to testkit-service:18085 in dev and prod.
 *
 * x-tenant-choice (tenant platform §5.3): the ONLY custom header the console
 * sends besides the bearer token. It is the explicit tenant choice the door
 * (testkit's tenant gate) validates against portal membership data, strips,
 * and converts into the trusted x-tenant-key the services accept. Every
 * request path that talks to testkit rides this umi request instance — the
 * generated services, and through them the login/logout/upload-STS flows —
 * so one interceptor covers them all. The single deliberate exception in the
 * app is the presigned PUT straight to object storage (SendEmail large
 * attachments): that URL is not a testkit surface, carries its own
 * signature, and must NOT carry the header.
 */
export const requestConfig: RequestConfig = {
  baseURL: '',

  requestInterceptors: [
    (config: any) => {
      const headers = (config.headers ?? {}) as Record<string, string>;
      const token = localStorage.getItem('testkit_token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      // The switcher's explicit choice; "" means send nothing (TENANT_ADMIN
      // single-binding default / PLATFORM cross-view). The door strips and
      // validates the header server-side — clients can never set the trusted
      // x-tenant-key directly.
      const choice = localStorage.getItem(TENANT_CHOICE_STORAGE_KEY);
      if (choice) {
        headers['x-tenant-choice'] = choice;
      }
      config.headers = headers;
      return config;
    },
  ],

  errorConfig: {
    // Surface non-2xx responses to errorHandler below.
    errorHandler(error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        // Token expired / revoked — clear session and bounce to login. The
        // tenant choice goes with it: it belongs to the previous identity
        // and must never ride a fresh login.
        localStorage.removeItem('testkit_token');
        localStorage.removeItem('testkit_user');
        localStorage.removeItem(TENANT_CHOICE_STORAGE_KEY);
        if (!window.location.pathname.startsWith('/user/login')) {
          window.location.href = '/user/login';
        }
      }
      throw error;
    },
  },
};
