// Post-processing for the service file produced by `max openapi` (see the
// `openapi` npm script). Runs AFTER max openapi, alongside fix-int64.js.
//
// Repairs gRPC-gateway custom-verb paths that @umijs/openapi mis-templates.
//
// The backend (grpc-gateway) exposes RPCs with custom verbs, e.g.
//   POST /api/v1/files/uploads:confirm
//   GET  /api/v1/files:page
//   POST /api/v1/files/{file_id}:downloadUrl
// The colon (`:verb`) is part of the URL. swagger2openapi keeps it correctly
// in openapi.json, but @umijs/openapi's path templater wrongly converts the
// trailing `:verb` into a template-literal interpolation `${verb}`, producing
//   request<...>(`/api/v1/files/uploads${confirm}`, ...)
// At runtime `${confirm}` is the global `confirm` function (=> garbage URL) or,
// for non-global names like `downloadUrl`, a ReferenceError. Either way the
// request hits the wrong path.
//
// Real path params are templated by the generator as `${param0}`, `${param1}`,
// ... so any `${identifier}` whose name is NOT `paramN` is a broken custom verb.
// We rewrite those back to the literal `:verb` suffix the backend expects.
//
// Second repair: @umijs/openapi types bodyless RPCs (google.protobuf.Empty or
// no request fields -> JSON-schema `true`) as `type XBody = true`, making the
// generated `body` parameter require the literal `true` — a value that would
// serialize to a JSON body of `true` and fail protojson parsing. Omitting the
// body is what those RPCs expect (grpc-gateway decodes an absent body as the
// empty message), so we make exactly those `body` parameters optional. Types
// are collected from typings.d.ts; only `= true` bodies are touched.
const fs = require("fs");
const path = require("path");

const servicesDir = path.join(__dirname, "..", "src", "services", "testkit");
const file = path.join(servicesDir, "testkitService.ts");
const src = fs.readFileSync(file, "utf8");

let repaired = 0;
const out = src.replace(/`[^`]*`/g, (tmpl) => {
  // Only operate on backtick template literals (the request URLs).
  return tmpl.replace(/\$\{([a-zA-Z_]\w*)\}/g, (m, name) => {
    if (/^param\d+$/.test(name)) return m; // legitimate path param
    repaired += 1;
    return `:${name}`;
  });
});

// --- optional-body repair (see header note) ---------------------------------
const typings = fs.readFileSync(path.join(servicesDir, "typings.d.ts"), "utf8");
const trueBodies = [...typings.matchAll(/type (\w+Body) = true;/g)].map(
  (m) => m[1],
);
let optionalized = 0;
const finalOut = trueBodies.reduce((acc, name) => {
  const pattern = new RegExp(`,body: API\\.${name},`);
  const next = acc.replace(pattern, () => {
    optionalized += 1;
    return `,body?: API.${name},`;
  });
  return next;
}, out);

fs.writeFileSync(file, finalOut);
console.log(
  `fix-services: repaired ${repaired} custom-verb path segment(s), ` +
    `optionalized ${optionalized} body param(s) for ${trueBodies.length} bodyless RPC type(s)`,
);
