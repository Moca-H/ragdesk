# ragdesk 内网部署说明

两种推荐方式：

| 方式 | 适合 | 依赖 |
|------|------|------|
| **Windows 便携包** | 单机 / 小团队共享一台 Windows | Python 3.11+ |
| **Docker Compose** | 服务器 / 机房 / 统一运维 | Docker |

开发机日常调试仍用仓库根目录 `.\dev.cmd` / `npm run dev`。

---

## 1. Windows 便携包

### 1.1 打包（维护者）

在源码仓库根目录：

```powershell
.\scripts\build-release.ps1
```

产物：

- `release/ragdesk-portable/` — 可直接拷贝
- `release/ragdesk-portable.zip` — 发给同事

也可：`npm run build:release`

### 1.2 安装与启动（使用方）

1. 解压到任意目录（建议路径不含特殊字符）。
2. 确认已安装 **Python 3.11+**，且 `python` / `py` 在 PATH 中。  
   示例：`winget install Python.Python.3.12`
3. （可选）复制 `.env.example` 为 `.env` 并修改。
4. 双击 `start.cmd`。
5. 浏览器打开 http://127.0.0.1:8000  

首次启动会创建 `.venv` 并安装依赖，可能需要几分钟。

### 1.3 局域网访问

默认监听 `0.0.0.0:8000`。同事访问：

```text
http://<部署机局域网IP>:8000
```

若连不上，检查：

- Windows 防火墙是否放行入站 TCP `8000`
- `.env` 里 `RAGDESK_HOST` 是否为 `0.0.0.0`（不要写成仅 `127.0.0.1`）
- 多网卡时确认用的是内网 IP

若页面从「另一主机名/端口」打开且接口异常，可在 `.env` 增加：

```env
RAGDESK_CORS_ORIGINS=http://192.168.1.10:8000
```

同端口同源访问时一般不需要改 CORS。

### 1.4 数据与备份

运行后数据在便携包内的 `data/`（上传文件、Chroma、知识库元数据）。  
备份/迁移：停服务后拷贝整个 `data/` 目录即可。

---

## 2. Docker Compose（内网服务器）

### 2.1 启动

```bash
cp .env.example .env   # 按需修改
docker compose up --build -d
```

浏览器：http://\<服务器IP\>:8080  

- `web`：Nginx 静态页 + 反代 `/api`
- `api`：FastAPI + 数据卷 `ragdesk-data`

### 2.2 常用环境变量

见仓库根目录 [`.env.example`](../.env.example)。内网常用：

| 变量 | 说明 |
|------|------|
| `RAGDESK_API_TOKEN` | 启用后，除 `/api/health` 外需 Bearer Token |
| `RAGDESK_LOCK_SETTINGS` | `1`/`true` 时网页不能改 Provider/模型 |
| `RAGDESK_PROVIDER` 等 | 服务端预配模型，配合锁定适合统一发放 |
| `RAGDESK_CORS_ORIGINS` | 额外允许的前端 Origin（一般 Docker 同域不需要） |

网页「设置」里填写并保存**客户端 API Token**，与服务端 `RAGDESK_API_TOKEN` 一致。

### 2.3 反向代理（可选）

前面再挂 Nginx / Caddy 时，注意：

- 聊天与上传为长连接 / 大 body：关闭或加大缓冲，放宽 `client_max_body_size`（示例 50m）
- SSE：关闭 proxy buffering，拉长 `proxy_read_timeout`
- 若终结 HTTPS，保持 `/api` 与静态页同域，避免跨域

---

## 3. 安全建议（内网）

1. **不要**把未设 Token 的实例直接暴露到公网。
2. 共享部署务必设置 `RAGDESK_API_TOKEN`，并定期轮换。
3. 模型 Key 优先放服务端环境变量 + `RAGDESK_LOCK_SETTINGS=1`，减少终端用户误改。
4. 只读知识库可用于「成品库」防误删；ZIP 导出做备份。
5. 监视文件夹路径是**服务端本机路径**（Docker 内需挂载卷后再填容器内路径）。

---

## 4. 健康检查

```bash
curl http://127.0.0.1:8000/api/health          # 便携包
curl http://127.0.0.1:8080/api/health          # Docker（经 Nginx）
```

详细状态（需 Token 时带上 Header）：

```bash
curl -H "Authorization: Bearer <token>" http://127.0.0.1:8000/api/health/detail
```

CLI（源码树）：

```powershell
python apps/cli/ragdesk_cli.py health
```

---

## 5. 故障排查

| 现象 | 处理 |
|------|------|
| `start.cmd` 提示缺 Python | 安装 3.11+ 并勾选 Add to PATH，重开终端 |
| 首次 pip 很慢 / 失败 | 配置国内 PyPI 镜像后删 `.venv` 再启动 |
| 局域网打不开 | 查防火墙、HOST、IP；本机先访问 127.0.0.1:8000 |
| 401 未授权 | 服务端已设 Token，在网页设置里保存相同客户端 Token |
| 换 Embedding 后问答不准 | 资料库点「重建索引」 |
