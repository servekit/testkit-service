// Post-processing for the OpenAPI 3.0 spec produced by `swagger2openapi`
// (see the `openapi` npm script). Run before `max openapi`. Two responsibilities,
// shared by every domain's codegen (P2-P6):
//
// 1. int64 -> string (defensive). proto3 JSON (grpc-gateway / protojson)
//    serializes int64 as a STRING for precision past 2^53 (snowflake IDs,
//    timestamps, ...). protoc-gen-openapiv2 is protojson-aware and already
//    emits those fields as `type: string, format: int64`, so @umijs/openapi
//    already generates `string`. We still rewrite any stray `integer/int64`
//    that might slip through (e.g. from other producers) so the generated TS
//    always matches protojson's string wire values.
//
// 2. Strip error responses. protoc-gen-openapiv2 emits both a `200` success
//    response and a `default` error response (rpcStatus) for every operation.
//    @umijs/openapi iterates `responses` with Object.entries and keeps the LAST
//    entry's schema as the return type, so it wrongly types every function as
//    `API.rpcStatus`. Drop the `default` (and 4xx/5xx) responses so only the
//    success response remains — the generator then emits the correct type
//    (e.g. API.v1TokenResponse for login).
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'config', 'openapi.json');
const spec = JSON.parse(fs.readFileSync(file, 'utf8'));

// --- 1. int64 -> string -----------------------------------------------------
// proto3 JSON serializes int64 as a STRING for precision past 2^53 (snowflake
// IDs, timestamps, ...). protoc-gen-openapiv2 is protojson-aware and marks
// those fields `{ type: "string", format: "int64" }`. Unfortunately @umijs/openapi
// keys the generated TS type off `format` (int64 -> number), ignoring `type`, so
// it would emit `id: number` and silently drop snowflake precision. We therefore
// force every int64-family field to plain `string` (drop the format) regardless
// of whether the producer wrote `string/int64` or `integer/int64`.
const INT64_FORMATS = new Set([
  'int64',
  'uint64',
  'sint64',
  'fixed64',
  'sfixed64',
]);

let changed = 0;
function visit(node) {
  if (Array.isArray(node)) {
    node.forEach(visit);
    return;
  }
  if (node && typeof node === 'object') {
    if (INT64_FORMATS.has(node.format)) {
      node.type = 'string';
      delete node.format;
      changed += 1;
    }
    for (const v of Object.values(node)) visit(v);
  }
}
visit(spec);

// --- 2. drop error responses so the generator picks the success type --------
let stripped = 0;
const ERROR_CODES = /^(default|[345]\d\d)$/;
for (const pathItem of Object.values(spec.paths || {})) {
  if (!pathItem || typeof pathItem !== 'object') continue;
  for (const op of Object.values(pathItem)) {
    const responses = op && op.responses;
    if (!responses) continue;
    for (const code of Object.keys(responses)) {
      if (ERROR_CODES.test(code)) {
        delete responses[code];
        stripped += 1;
      }
    }
  }
}

fs.writeFileSync(file, JSON.stringify(spec, null, 2));
console.log(`fix-int64: rewrote ${changed} int64 field(s); stripped ${stripped} error response(s)`);
