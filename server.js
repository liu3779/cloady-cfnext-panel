import { Miniflare } from "miniflare";

const port = parseInt(process.env.PORT || "3000", 10);

const mf = new Miniflare({
  modules: true,
  scriptPath: "./worker.js",
  kvNamespaces: ["K"],
  kvPersist: "./kv-data",
  bindings: { L: process.env.PANEL_PATH || "admin" },
  compatibilityDate: "2024-01-01",
  port,
  host: "0.0.0.0",
});

await mf.ready;
console.log(`CFNext panel listening on :${port}`);

const shutdown = async () => {
  await mf.dispose();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
