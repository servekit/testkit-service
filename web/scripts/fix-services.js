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
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'src',
  'services',
  'testkit',
  'testkitService.ts',
);
const src = fs.readFileSync(file, 'utf8');

let repaired = 0;
const out = src.replace(/`[^`]*`/g, (tmpl) => {
  // Only operate on backtick template literals (the request URLs).
  return tmpl.replace(/\$\{([a-zA-Z_]\w*)\}/g, (m, name) => {
    if (/^param\d+$/.test(name)) return m; // legitimate path param
    repaired += 1;
    return `:${name}`;
  });
});

fs.writeFileSync(file, out);
console.log(`fix-services: repaired ${repaired} custom-verb path segment(s)`);
