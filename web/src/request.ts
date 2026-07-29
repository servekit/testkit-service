import type { RequestConfig } from '@umijs/max';

/**
 * Umi Max request config (re-exported from src/app.tsx as `export const request`).
 *
 * Note on baseURL: the OpenAPI spec paths already include the `/api` prefix
 * (e.g. `/api/v1/auth/login`), so @umijs/openapi generates request URLs that
 * start with `/api/`. We therefore leave baseURL empty to avoid double-prefixing.
 * nginx proxies `/api/` (and `/ping`) to testkit-service:18085 in dev and prod.
 */
export const requestConfig: RequestConfig = {
  baseURL: '',

  requestInterceptors: [
    (config: any) => {
      const token = localStorage.getItem('testkit_token');
      if (token) {
        const headers = (config.headers ?? {}) as Record<string, string>;
        headers.Authorization = `Bearer ${token}`;
        config.headers = headers;
      }
      return config;
    },
  ],

  errorConfig: {
    // Surface non-2xx responses to errorHandler below.
    errorHandler(error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        // Token expired / revoked — clear session and bounce to login.
        localStorage.removeItem('testkit_token');
        localStorage.removeItem('testkit_user');
        if (!window.location.pathname.startsWith('/user/login')) {
          window.location.href = '/user/login';
        }
      }
      throw error;
    },
  },
};
