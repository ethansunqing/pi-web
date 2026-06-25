# pi-web

[pi 编程智能体](https://github.com/earendil-works/pi) 的网页界面。在浏览器中浏览会话、与智能体对话、分叉对话、切换消息分支。

## 来源与致谢

本仓库是基于 [agegr/pi-web](https://github.com/agegr/pi-web) 的个人二次开发版本，不是从零开始开发的项目。

感谢原作者 [agegr](https://github.com/agegr) 提供的 pi-web 项目和开发思路；本仓库主要是在原项目基础上结合个人使用习惯继续调整、同步上游更新，并补充了一些本地化与模型配置相关能力。

同时感谢 [earendil-works/pi](https://github.com/earendil-works/pi) 项目提供底层 pi coding agent 能力。本项目会尽量保留原项目的设计思路与开源许可说明，后续改动也会在更新日志中记录来源和调整内容。

## 快速开始

**无需安装，直接运行：**

```bash
npx @agegr/pi-web@latest
```

**或全局安装后使用：**

```bash
npm install -g @agegr/pi-web
pi-web
```

启动后打开 [http://localhost:3000](http://localhost:3000)。

**可选参数：**

```bash
pi-web --port 8080               # 自定义端口
pi-web --hostname 127.0.0.1      # 仅本机访问
pi-web -p 8080 -H 127.0.0.1     # 组合使用

PORT=8080 pi-web                 # 也支持环境变量
```

健康检查 API：`GET /api/health`（返回版本、数据目录与配置文件检查结果）。

## 功能介绍

- **会话浏览器** — 按本机 / 项目 / 工作区组织展示 pi 会话
- **实时对话** — 通过 SSE 流式输出与智能体实时交互
- **实时状态** — 对运行中会话同步上下文、token / cost 统计与压缩状态
- **会话分叉** — 从任意用户消息创建独立的新会话分支
- **会话内分支** — 回退到任意节点继续对话，在同一文件内创建分支
- **分支导航器** — 可视化切换同一会话内的各个分支
- **模型切换** — 对话中途随时切换模型
- **工具面板** — 控制智能体可使用的工具
- **压缩会话** — 对长会话进行摘要，节省上下文窗口
- **引导 / 追加** — 打断正在运行的智能体，或在其完成后追加消息

## 注意事项

- **数据目录** — 默认读取 `~/.pi/agent/sessions` 下的会话文件。可通过环境变量 `PI_CODING_AGENT_DIR` 指定其他目录。
- **模型配置** — 从智能体数据目录下的 `models.json` 读取可用模型，可在侧边栏的「Models」面板中编辑。
- **文件浏览** — 侧边栏内置文件浏览器，可在标签页中查看当前工作目录下的文件。

## 开发

```bash
npm install
npm run dev   # 端口 3000
npm run typecheck
npm run lint
```

## 项目结构

```
app/
  api/
    sessions/      # 读写会话文件
    agent/         # 发送命令、SSE 事件流
    files/         # 文件内容读取
    models/        # 可用模型列表与默认模型
    models-config/ # 读写 models.json
components/        # UI 组件
lib/
  session-reader.ts  # 解析 .jsonl 会话文件
  rpc-manager.ts     # 管理 AgentSession 生命周期
  normalize.ts       # 规范化 toolCall 字段名
  types.ts
```

会话文件存储路径：`~/.pi/agent/sessions/<编码后的工作目录>/<时间戳>_<uuid>.jsonl`
