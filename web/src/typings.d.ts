// Convenience aliases over the generated types. @umijs/openapi preserves the
// swagger `v1` prefix on generated type names (e.g. API.v1User, API.v1TokenResponse),
// but the application refers to the clean names API.User / API.TokenResponse /
// API.LoginRequest. This file namespace-merges with the generated
// src/services/testkit/typings.d.ts, so the aliases track the generator output
// automatically — regenerate-safe, no hand-maintenance.
declare namespace API {
  type User = v1User;
  type TokenResponse = v1TokenResponse;
  type LoginRequest = v1LoginRequest;
}
