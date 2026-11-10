# cloady-cfnext-panel

CFNext 面板（前端）+ CFNext 节点后端（后端），装在一个容器里跑。

- `worker.js` — CFNext 前端：控制台 + 订阅聚合（它自己不存节点，订阅全从后端拉）。
- `backend.js` — CFNext 后端：VLESS / Trojan 数据面 + 生成订阅（301 个优选 IP 节点）。
  这是上游原文件，构建时由 `patch-backend.mjs` 打一个补丁（见下）。
- `server.js` — 路由器：一个 Node 进程里跑两个 Miniflare 实例（前端 :3101、后端 :3102），
  按路径分发到 $PORT，对外只有一个口。WebSocket 升级也透传，所以后端的数据面能直接用。
- `patch-backend.mjs` — 构建时补丁：删掉后端里唯一的 http→https 重定向。
  容器在 Cloady TLS 边缘后面跑，内部是 plain HTTP，重定向会把前端到后端的内网请求
  301 到 https://localhost 导致 TLS 报错。文件里 `r.protocol` 只在这一处用，
  其余逻辑不依赖协议；生成的节点仍是 wss/tls，不影响客户端。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `PANEL_PATH` | 面板入口路径，默认 `admin`（即 /admin） |
| `BACKEND_API` | **必填**。前后端之间的共享密钥（前端用 X-CF-Api 调后端） |
| `BACKEND_UUID` | **必填**。后端节点 UUID（订阅里的节点都用它，WS 路径也是 /<UUID>） |
| `PUBLIC_HOST` | 公网域名（不带协议），如 `cloady-cfnext-panel-xxx-workspace-vo8y4q.cloady.io`；生成节点里的 servername / Host 用它 |
| `PORT` | 容器监听端口，默认 3000 |

## 前端里配后端

登录 /admin 后，在「面板设置 → 多后端管理」里加一个后端：

- 地址：`http://localhost:3000`（容器内网，路由器自己；不要填公网域名，会被前端当成自指拒绝）
- API 密钥：`BACKEND_API` 的值
- UUID：`BACKEND_UUID` 的值

配好后 `/aggregate/sub/clash` 就是聚合订阅。注意：后端内置的 301 个优选 IP 节点是
Cloudflare 优选 IP 形态（连 CF 的 IP、SNI 是本域名），在 Cloady 上**不能直接用**；
能用的节点是后端本身——直连公网域名、UUID 用 `BACKEND_UUID`、WS 路径 `/<UUID>?ed=2048`：

```
vless://<BACKEND_UUID>@<PUBLIC_HOST>:443?encryption=none&security=tls&sni=<PUBLIC_HOST>&type=ws&host=<PUBLIC_HOST>&path=%2F<BACKEND_UUID>%3Fed%3D2048#CFNext-后端
```

想把自己的 xray 节点也放进面板订阅，在后端控制台里用「自定义订阅」模式加订阅源
（例如美东那个 /sub），或把公网域名加进「优选节点」。

## 部署

Cloady（日本 JPN1）Dockerfile 部署，仓库即本仓库。账号：liu.xiang4020@gmail.com，
工作区 workspace-vo8y4q。注意该账号是免费试用到 2026-12-11，到期后需 $3/月续费否则停机。
