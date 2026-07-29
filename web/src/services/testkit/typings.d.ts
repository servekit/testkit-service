declare namespace API {
  type protobufAny = {
    "@type"?: string;
  };

  type rpcStatus = {
    code?: number;
    message?: string;
    details?: protobufAny[];
  };

  type v1IdentityProvider =
    | "IDENTITY_PROVIDER_UNSPECIFIED"
    | "IDENTITY_PROVIDER_EMAIL"
    | "IDENTITY_PROVIDER_PHONE"
    | "IDENTITY_PROVIDER_GITHUB"
    | "IDENTITY_PROVIDER_GOOGLE"
    | "IDENTITY_PROVIDER_WECHAT"
    | "IDENTITY_PROVIDER_APPLE"
    | "IDENTITY_PROVIDER_WECHAT_MINIPROGRAM"
    | "IDENTITY_PROVIDER_ADMIN";

  type v1LoginMethod =
    | "LOGIN_METHOD_UNSPECIFIED"
    | "LOGIN_METHOD_EMAIL_PASSWORD"
    | "LOGIN_METHOD_PHONE_PASSWORD"
    | "LOGIN_METHOD_PHONE_CODE"
    | "LOGIN_METHOD_EMAIL_CODE"
    | "LOGIN_METHOD_USERNAME_PASSWORD";

  type v1LoginRequest = {
    method?: v1LoginMethod;
    username?: string;
    password?: string;
    code?: string;
    email?: string;
    regionCode?: string;
    phone?: string;
    /** captcha_id returned by SendVerificationCode; required for code-based login. */
    captchaId?: string;
  };

  type v1Pong = {
    /** service name, e.g. "demo-service" */
    service?: string;
    /** semantic version (ldflags; "dev" by default) */
    version?: string;
    /** short commit hash (ldflags or VCS-embedded) */
    gitCommit?: string;
    /** git branch (ldflags) */
    gitBranch?: string;
    /** build time, RFC3339 UTC (ldflags) */
    buildTime?: string;
    /** Go toolchain version (runtime, not injected) */
    goVersion?: string;
    /** "SERVING" when serving normally */
    status?: string;
    /** server time, Unix millis */
    now?: string;
    /** process start time, Unix millis (client computes uptime) */
    startedAt?: string;
  };

  type v1RefreshSessionRequest = {
    sessionId?: string;
  };

  type v1RegisterRequest = {
    provider?: v1IdentityProvider;
    email?: string;
    code?: string;
    username?: string;
    nickname?: string;
    password?: string;
    regionCode?: string;
    phone?: string;
    /** captcha_id returned by SendVerificationCode; required to verify the code. */
    captchaId?: string;
  };

  type v1SendVerificationCodeRequest = {
    email?: string;
    channel?: v1VerificationChannel;
    purpose?: v1VerificationPurpose;
    regionCode?: string;
    phone?: string;
    /** sender_id is the audit actor triggering this send (user id, service name,
platform identifier, ...). user-service is stateless and passes it through
verbatim; for unauthenticated flows (register/login) the frontend supplies
a platform identifier (e.g. the target email/phone or "testkit-web"). */
    senderId?: string;
  };

  type v1SendVerificationCodeResponse = {
    captchaId?: string;
  };

  type v1TokenResponse = {
    token?: string;
    user?: v1User;
  };

  type v1User = {
    id?: string;
    username?: string;
    email?: string;
    phone?: string;
    nickname?: string;
    userType?: v1UserType;
  };

  type v1UserType =
    | "USER_TYPE_UNSPECIFIED"
    | "USER_TYPE_NORMAL"
    | "USER_TYPE_INTERNAL";

  type v1VerificationChannel =
    | "VERIFICATION_CHANNEL_UNSPECIFIED"
    | "VERIFICATION_CHANNEL_EMAIL"
    | "VERIFICATION_CHANNEL_SMS";

  type v1VerificationPurpose =
    | "VERIFICATION_PURPOSE_UNSPECIFIED"
    | "VERIFICATION_PURPOSE_REGISTER"
    | "VERIFICATION_PURPOSE_LOGIN"
    | "VERIFICATION_PURPOSE_VERIFY_EMAIL"
    | "VERIFICATION_PURPOSE_VERIFY_PHONE"
    | "VERIFICATION_PURPOSE_PASSWORD_RESET"
    | "VERIFICATION_PURPOSE_BIND";
}
