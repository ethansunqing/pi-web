# 更新日志

## 2026-06-08

### 集成 PR #52: normalizeCwd 提取 + KaTeX 数学公式 + compressTree
- **来源:** https://github.com/agegr/pi-web/pull/52
- 新增 `lib/cwd.ts`：提取 normalizeCwd 函数（~/ 展开 + 路径标准化）
- `agent/new/route.ts`：使用 normalizeCwd 标准化路径
- `cwd/validate/route.ts`：删除内联实现，改用 @/lib/cwd
- `sessions/[id]/route.ts`：新增 compressTree 折叠单子分支链
- 新增依赖：katex, rehype-katex, remark-math（LaTeX 公式渲染）

### 集成 next-intl 中英双语界面支持 (PR #53)
- **来源:** https://github.com/agegr/pi-web/pull/53 by huantuoshen-prog
- 安装 `next-intl` 依赖
- 新增 `i18n/routing.ts`, `i18n/request.ts`, `middleware.ts`
- 新增 `messages/zh-CN.json`, `messages/en.json` (中英文翻译)
- 新增 `app/[locale]/layout.tsx` (NextIntlClientProvider 包装)
- 新增 `app/[locale]/page.tsx`
- 所有组件接入 `useTranslations`: AppShell, BranchNavigator, ChatInput, ChatWindow, FileExplorer, FileViewer, MessageView, ModelsConfig, SessionSidebar, SkillsConfig, TabBar, ToolPanel
- `next.config.ts`: 添加 `output: "standalone"` + `withNextIntl` 包装

### 会话导出 Markdown 功能
- **新增文件:** `lib/export-markdown.ts`, `app/api/sessions/[id]/export/route.ts`
- `GET /api/sessions/[id]/export` 返回格式化的 Markdown 文件下载
- 会话侧边栏悬停时新增导出按钮（下载图标）

### 修复压缩上下文问题
- **修改:** `lib/rpc-manager.ts` — 移除多余的压缩预检查逻辑
- **修改:** `hooks/useAgentSession.ts` — 压缩错误提示时间从 3s 延长到 10s

### 修复 MiniMax-M3 模型支持
- 修复 MiniMax-CN 平台 M3 模型的兼容性问题

### 默认端口改为 3000
- 开发服务器端口从默认改为 3000

---

## 2026-06-04

### 依赖升级
- 升级 `pi-ai` 和 `pi-coding-agent` 到 v0.78.0

### IME 输入法处理
- 添加 IME 组合输入处理，防止输入法确认时误触 Enter 发送

### Mermaid 图表渲染
- 支持 Mermaid 图表实时预览，带主题切换

### 消息过滤优化
- 过滤掉 agent session 消息更新中的 user role 消息

### 工作区路径验证
- 添加异步路径验证和错误反馈

### PDF/DOCX 文件预览
- 支持 PDF 和 DOCX 文件实时预览、同步和下载

---

## 2026-05-31

- 刷新 npm lockfile 元数据

---

## 2026-05-27

- `package.json` 添加 MIT License
- 模型连接测试（延迟追踪和响应验证）

---

## 2026-05-23

- 模型下拉菜单定位修复
- 音频文件预览
- OAuth 设备码流程

---

## 2026-05-22

- 跨平台路径处理

---

## 2026-05-21

- 版本更新至 0.6.8
- skills.sh API 集成
