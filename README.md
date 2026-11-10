# cloady-cfnext-panel

CFNext 订阅面板（Cloudflare Workers 脚本），用 Miniflare 跑在容器里，部署在 Cloady 免费档上。

## 它是什么

- 一个节点订阅管理面板：管理后台 + 聚合订阅（Clash / Sing-box / Karing 等格式）。
- 它本身不是节点、不跑代理流量（WebSocket 数据面是关掉的），节点要另外加：面板里有自定义订阅源和默认节点入口。
- 配置（登录密码、后端、订阅源）存在 KV 里，落盘在容器内 `./kv-data`；容器重建会丢，记得备份好后端列表。

## 运行

```sh
npm install
node server.js   # 监听 $PORT（默认 3000）
```

环境变量：

- `PORT`：监听端口（Cloady 会注入）。
- `PANEL_PATH`：面板入口路径，默认 `admin`，即打开 `https://<域名>/admin`。

首次打开 `/admin` 会让设置管理密码，设好就进控制台。

## 部署（Cloady）

Dockerfile 部署，Cloady 会分配 `https://<app>-<code>-<workspace>.cloady.io`。
