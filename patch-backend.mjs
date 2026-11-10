// Build-time patch for backend.js (the CFNext backend Worker).
// Removes the single http -> https redirect. The backend checks r.protocol
// exactly once in the whole file, for that redirect; nothing else depends on
// the request being https. The container runs behind Cloady's TLS edge
// (clients always reach it over https), so the redirect is not needed and
// would break the internal plain-HTTP hop (frontend -> router -> backend).
// Generated nodes still use wss/tls (security defaults to "tls" in the
// backend), so clients are unaffected.
import { readFileSync, writeFileSync } from "node:fs";

const file = "backend.js";
const src = readFileSync(file, "utf8");
const oldText =
  'if ("http:" === r.protocol)\n        return Response.redirect(r.href.replace("http://", "https://"), 301);';
const occurrences = src.split(oldText).length - 1;
if (occurrences !== 1) {
  throw new Error(`expected exactly 1 http->https redirect in ${file}, found ${occurrences}; refusing to patch`);
}
const patched = src.replace(
  oldText,
  '// [container patch] http->https redirect removed (TLS is terminated at the edge)\n        // [container patch] see patch-backend.mjs for why this is safe',
);
writeFileSync(file, patched);
console.log("patched backend.js: removed http->https redirect");
