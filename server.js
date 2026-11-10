import http from "node:http";
import net from "node:net";
import { Miniflare } from "miniflare";

// One container, two Workers:
//  - frontend (CFNext console / subscription aggregator) on 127.0.0.1:3101
//  - backend  (CFNext node worker: VLESS/Trojan data plane + subscriptions) on 127.0.0.1:3102
// A tiny router on $PORT dispatches by path, including WebSocket upgrades.
// The frontend talks to the backend through the router itself:
//   BACKEND_URL = http://127.0.0.1:$PORT  (set in the frontend's backend list)
// Generated nodes point at PUBLIC_HOST (the public domain), so clients reach
// the backend data plane through this same router.

const PORT = parseInt(process.env.PORT || "3000", 10);
const FE_PORT = 3101;
const BE_PORT = 3102;
const BACKEND_UUID = (process.env.BACKEND_UUID || "").trim();
const API_KEY = (process.env.BACKEND_API || "").trim();
const PUBLIC_HOST = (process.env.PUBLIC_HOST || "").trim();

if (!API_KEY) {
  console.error("BACKEND_API env is required (shared key between frontend and backend)");
  process.exit(1);
}
if (!BACKEND_UUID) {
  console.error("BACKEND_UUID env is required (backend node UUID)");
  process.exit(1);
}

const fe = new Miniflare({
  modules: true,
  scriptPath: "./worker.js",
  kvNamespaces: ["K"],
  kvPersist: "./kv-data-fe",
  bindings: { L: process.env.PANEL_PATH || "admin" },
  compatibilityDate: "2024-01-01",
  port: FE_PORT,
  host: "127.0.0.1",
});

const be = new Miniflare({
  modules: true,
  scriptPath: "./backend.js",
  kvNamespaces: ["K"],
  kvPersist: "./kv-data-be",
  bindings: {
    API: API_KEY,
    U: BACKEND_UUID,
    HOST: PUBLIC_HOST,
  },
  compatibilityDate: "2024-01-01",
  port: BE_PORT,
  host: "127.0.0.1",
});

await fe.ready;
await be.ready;
console.log(`frontend on 127.0.0.1:${FE_PORT}, backend on 127.0.0.1:${BE_PORT}`);

function targetFor(req) {
  const u = new URL(req.url || "/", "http://x");
  const p = u.pathname;
  if (p === "/" || p === "/backends" || p === "/setpass") return FE_PORT;
  if (p.startsWith("/admin") || p.startsWith("/aggregate/")) return FE_PORT;
  const m = p.match(/^\/[^/]+\/sub\//);
  if (m) {
    // /<uuid>/sub/* -> backend; /<backend-name>/sub/* (frontend multi mode) -> frontend
    const seg = p.split("/")[1];
    if (seg === BACKEND_UUID) return BE_PORT;
    return FE_PORT;
  }
  return BE_PORT; // /api/* (backend admin API), /<uuid> WS data plane, /crules/*
}

const server = http.createServer((req, res) => {
  const port = targetFor(req);
  const proxyReq = http.request(
    {
      host: "127.0.0.1",
      port,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (e) => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("proxy error: " + e.message);
  });
  req.pipe(proxyReq);
});

server.on("upgrade", (req, socket, head) => {
  const port = targetFor(req);
  const target = net.connect(port, "127.0.0.1", () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (const [k, v] of Object.entries(req.headers)) lines.push(`${k}: ${v}`);
    target.write(lines.join("\r\n") + "\r\n\r\n");
    if (head && head.length) target.write(head);
    socket.pipe(target);
    target.pipe(socket);
  });
  target.on("error", () => socket.destroy());
  socket.on("error", () => target.destroy());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`router listening on :${PORT} (public host: ${PUBLIC_HOST || "(unset)"})`);
});

const shutdown = async () => {
  await fe.dispose();
  await be.dispose();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
