// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 此处后端没有提供注释 POST /api/v1/auth/login */
export async function login(
  body: API.v1LoginRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** Logout revokes the caller's current session. session_id is NOT in the
request — it is read from the authenticated context (set by the auth
interceptor from the JWT). POST /api/v1/auth/logout */
export async function logout(options?: { [key: string]: any }) {
  return request<Record<string, any>>("/api/v1/auth/logout", {
    method: "POST",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/auth/refresh */
export async function refreshSession(
  body: API.v1RefreshSessionRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1TokenResponse>("/api/v1/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/auth/register */
export async function register(
  body: API.v1RegisterRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1TokenResponse>("/api/v1/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/captcha/send */
export async function sendVerificationCode(
  body: API.v1SendVerificationCodeRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1SendVerificationCodeResponse>("/api/v1/captcha/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /ping */
export async function ping(options?: { [key: string]: any }) {
  return request<API.v1Pong>("/ping", {
    method: "GET",
    ...(options || {}),
  });
}
