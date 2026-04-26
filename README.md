# Guardrail UI

基于 [Vite](https://vite.dev/) 与 [React](https://react.dev/) 的聊天前端：左侧会话列表与导入导出，右侧对话区调用 Guardrails 兼容的 Chat Completions 接口；会话数据保存在浏览器本地（`localStorage`）。

## 环境要求

- [Node.js](https://nodejs.org/) 20+（建议使用当前 LTS）
- npm 10+（或兼容的 pnpm / yarn）

## 快速开始

```bash
# 安装依赖
npm install

# 复制环境变量模板并按需修改
cp .env.example .env

# 启动开发服务器（默认 http://localhost:5173）
npm run dev
```

在浏览器中打开终端里打印的本地地址即可使用。

## 环境变量

在项目根目录创建 `.env`（可参考 `.env.example`）。本项目在 `vite.config.js` 中配置了 `envPrefix: ['VITE_', 'CHAT_']`，因此以 `CHAT_` 或 `VITE_` 开头的变量会注入到前端代码的 `import.meta.env` 中。

| 变量                        | 必填 | 说明                                                                                                               |
| --------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `CHAT_API_URL`              | 建议 | 聊天接口完整 URL，例如 `http://127.0.0.1:8000/v1/chat/completions`。未配置时界面仍可打开，发送消息会进入演示提示。 |
| `CHAT_GUARDRAILS_CONFIG_ID` | 否   | 请求体 `guardrails.config_id`，默认 `mybot`。                                                                      |
| `CHAT_MODEL`                | 否   | 请求体 `model`，默认 `deepseek-r1:8b`。                                                                            |

**安全提示：** `.env` 已列入 `.gitignore`，请勿将含密钥或内网地址的 `.env` 提交到 Git。

## 接口约定

前端使用 `POST` + `Content-Type: application/json`，请求体由 `src/chatApi.js` 中的 `buildChatRequestPayload` 生成，形如：

```json
{
  "guardrails": { "config_id": "mybot" },
  "model": "deepseek-r1:8b",
  "messages": [
    { "role": "user", "content": "…" },
    { "role": "assistant", "content": "…" }
  ]
}
```

`messages` 为当前会话中已发送的用户与助手消息（不含空内容的占位）。响应需为 JSON，且助手回复从 `choices[0].message.content` 读取并展示在页面。

若浏览器与 API 不同源，需在后端配置 CORS，或通过 Vite 开发代理转发请求（可在 `vite.config.js` 中自行增加 `server.proxy`）。

## 常用脚本

| 命令              | 说明                     |
| ----------------- | ------------------------ |
| `npm run dev`     | 启动开发服务器（热更新） |
| `npm run build`   | 生产构建，输出到 `dist/` |
| `npm run preview` | 本地预览生产构建结果     |
| `npm run lint`    | 运行 ESLint              |

## 功能说明

- **新建 / 切换 / 重命名 / 删除** 会话；删除至无会话时会自动新建一条。
- **Clear conversations**：清空并新建会话。
- **Import / Export conversations**：将 `localStorage` 中的会话导出为 JSON 文件，或从 JSON 恢复。
- 会话持久化键名：`guardrail_chat_conversations_v1`（见 `src/chatStorage.js`）。

## 项目结构（简要）

```
src/
  ChatApp.jsx      # 主界面与交互
  ChatApp.css
  chatApi.js       # API 请求与响应解析
  chatStorage.js   # 本地存储与导入导出
  App.jsx
  main.jsx
```

## Docker

#### 构建 UI 镜像

```bash
docker build \
  --build-arg CHAT_API_URL="http://127.0.0.1:8000/v1/chat/completions" \
  --build-arg CHAT_MODEL="deepseek-r1:8b" \
  -t guardrail-ui .
```

## 许可证

私有项目或未声明时，以仓库内约定为准。
