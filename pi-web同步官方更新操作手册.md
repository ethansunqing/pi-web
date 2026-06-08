# pi-web 同步官方更新操作手册（小白版）

> 适用于你当前的真实配置。  
> 你的私有仓库：<https://github.com/ethansunqing/pi-web>  
> 原作者仓库：<https://github.com/agegr/pi-web>  
> 你的二次开发分支：`custom/main`

---

## 一、先记住仓库关系

```text
原作者仓库
upstream/main
https://github.com/agegr/pi-web
        │
        │ 下载作者更新
        ▼
你本地的 main
        │
        │ 确认后合并
        ▼
你本地的 custom/main
        │
        │ 推送备份
        ▼
你的私有 GitHub 仓库
origin
https://github.com/ethansunqing/pi-web
```

| 名称 | 实际用途 |
|---|---|
| `upstream/main` | 原作者最新代码 |
| `main` | 你本地用于跟随原作者的分支 |
| `custom/main` | 你的二次开发稳定版本 |
| `origin` | 你自己的私有 GitHub 仓库 |

你的修改目前主要包括：

- 默认端口从 `30141` 改为 `3000`。
- `pi-ai` 和 `pi-coding-agent` 升级到 `0.78.1`，支持 `MiniMax-M3`。

同步官方时，要注意这些修改是否和作者的新版本发生冲突。

---

## 二、什么时候需要同步

出现下面情况时可以同步：

- 原作者发布了新版本。
- 原作者修复了你需要的问题。
- 你准备开发新功能，希望先基于最新代码。
- 你发现自己的版本比官方落后较多。

不建议每天都同步。一般看到重要更新后再同步即可。

---

## 三、同步前必须做的检查

打开终端：

```bash
cd ~/Projects/pi-web
git status
```

理想结果：

```text
nothing to commit, working tree clean
```

如果看到有修改但还没有提交，先不要同步。

### 方法一：修改已经完成，先提交

```bash
git add .
git commit -m "wip: 同步官方前保存本地修改"
git push origin custom/main
```

### 方法二：修改暂时不想提交，临时收起来

```bash
git stash push -m "同步官方前临时保存"
```

同步结束后再恢复：

```bash
git stash pop
```

小白建议优先使用方法一：先提交、先推送，再同步。

---

## 四、先查看作者有没有更新

```bash
cd ~/Projects/pi-web
git fetch upstream
git log main..upstream/main --oneline
```

### 情况一：没有任何输出

说明你的 `main` 已经包含作者当前最新代码，不需要同步。

### 情况二：出现提交记录

例如：

```text
1234567 fix: 修复会话显示问题
89abcde feat: 增加新功能
```

说明原作者有新提交，可以继续同步。

查看作者最近 10 次提交：

```bash
git log upstream/main -10 --oneline
```

只下载更新不会修改你的代码：

```bash
git fetch upstream
```

所以 `git fetch upstream` 可以放心执行。

---

## 五、标准同步流程

完整流程分为两步：

1. 先更新 `main`。
2. 再把 `main` 合并到 `custom/main`。

### 第一步：更新 main

```bash
cd ~/Projects/pi-web
git checkout main
git pull origin main
git fetch upstream
git merge upstream/main
```

如果没有冲突，继续：

```bash
git push origin main
```

此时：

- 本地 `main` 已经跟上作者。
- 私有 GitHub 仓库里的 `main` 也已经更新。
- 你的 `custom/main` 暂时还没有变化。

### 第二步：把官方更新合并到 custom/main

```bash
git checkout custom/main
git pull origin custom/main
git merge main
```

如果终端没有出现 `CONFLICT`，说明 Git 已自动合并。

继续安装依赖：

```bash
npm install
```

运行检查：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

启动测试：

```bash
npm run dev
```

浏览器打开：

<http://localhost:3000>

至少检查：

- 页面能正常打开。
- 原来的会话能正常显示。
- 模型列表能正常显示。
- `MiniMax-M3` 仍然存在。
- 可以发送消息。
- 默认端口仍然是 `3000`。

确认正常后，在运行服务的终端按 `Control + C` 停止服务。

最后推送：

```bash
git push origin custom/main
```

---

## 六、最常用的一整套命令

确定本地没有未提交修改后，可以按顺序执行：

```bash
cd ~/Projects/pi-web

# 1. 下载作者最新信息
git fetch upstream

# 2. 更新 main
git checkout main
git pull origin main
git merge upstream/main
git push origin main

# 3. 将 main 合并到你的二开分支
git checkout custom/main
git pull origin custom/main
git merge main

# 4. 安装依赖并检查
npm install
npm run lint
npx tsc --noEmit
npm run build

# 5. 启动后在浏览器测试
npm run dev

# 6. 测试完成后按 Control + C，再推送
git push origin custom/main
```

不要一次性盲目复制全部命令。每一步看一下终端是否报错，再执行下一步。

---

## 七、如果出现冲突

冲突通常长这样：

```text
CONFLICT (content): Merge conflict in package.json
Automatic merge failed; fix conflicts and then commit the result.
```

先查看冲突文件：

```bash
git status
```

可能显示：

```text
both modified: package.json
both modified: README.md
```

冲突文件中会出现：

```text
<<<<<<< HEAD
这是你当前 custom/main 的内容
=======
这是作者 main 的内容
>>>>>>> main
```

需要人工决定最终内容，并删除这些冲突标记：

```text
<<<<<<< HEAD
=======
>>>>>>> main
```

### 使用 Cursor 或 VS Code 处理

编辑器通常会提供：

- `Accept Current Change`：保留你的内容。
- `Accept Incoming Change`：保留作者内容。
- `Accept Both Changes`：两边都保留，再人工整理。

### 本项目常见冲突怎么选

| 冲突文件 | 处理建议 |
|---|---|
| `package.json` | 保留作者新增依赖，同时确认 `dev` 和 `start` 端口仍是 `3000` |
| `package-lock.json` | 先解决 `package.json`，然后重新执行 `npm install` |
| `README.md` | 合并作者的新说明，同时保留端口 `3000` |
| `bin/pi-web.js` | 确认默认端口仍然是 `"3000"` |
| 模型依赖版本 | 比较作者版本。如果作者已经高于 `0.78.1`，通常使用作者的新版本 |
| 核心会话代码 | 不要盲目保留任意一方，需要理解双方修改 |

冲突解决完成后：

```bash
git add .
git status
git merge --continue
```

然后重新检查：

```bash
npm install
npm run lint
npx tsc --noEmit
npm run build
npm run dev
```

确认正常后：

```bash
git push origin custom/main
```

---

## 八、冲突看不懂时先撤销

如果冲突太多，或者不知道应该保留哪边，不要乱改。

在合并还没有完成时执行：

```bash
git merge --abort
```

检查：

```bash
git status
```

这会回到合并前的状态，不会删除你以前已经提交的修改。

然后可以把报错内容交给 Codex 处理。

---

## 九、同步后发现程序坏了怎么办

### 情况一：还没有推送

先查看最近提交：

```bash
git log --oneline --graph --decorate -10
```

不要直接运行：

```text
git reset --hard
```

这个命令可能删除未保存修改。先让 Codex 检查后再决定如何恢复。

### 情况二：已经推送

不要强制覆盖远程仓库。优先使用新提交撤销：

```bash
git log --oneline -10
```

找到合并提交后，再根据实际情况使用：

```bash
git revert -m 1 合并提交编号
```

`git revert -m 1` 只适合撤销合并提交，提交编号必须确认正确。不会操作时交给 Codex。

---

## 十、如何确认同步成功

查看分支状态：

```bash
git status
git branch -vv
```

查看作者版本和你的版本：

```bash
git log --oneline --graph --decorate --all -20
```

查看你的二开分支比作者多了哪些提交：

```bash
git log upstream/main..custom/main --oneline
```

正常情况下应能看到你的二开提交，例如：

```text
fix: add MiniMax-M3 support
chore: change default port to 3000
```

查看作者是否还有未同步提交：

```bash
git fetch upstream
git log main..upstream/main --oneline
```

没有输出表示 `main` 已跟上作者。

---

## 十一、你的私有仓库不会自动更新

原作者更新后：

- 你的电脑不会自动合并。
- 你的私有 GitHub 仓库也不会自动合并。
- 必须手动执行本手册中的同步命令。

原作者无法看到你的私有仓库，也无法直接修改你的代码。

你的 `upstream` 只是一个读取官方更新的地址：

```bash
git remote -v
```

应看到：

```text
origin    https://github.com/ethansunqing/pi-web.git
upstream  https://github.com/agegr/pi-web.git
```

---

## 十二、最安全的操作原则

1. 同步前先执行 `git status`。
2. 有本地修改时，先提交并推送。
3. 先更新 `main`，再合并进 `custom/main`。
4. 出现冲突时不要盲目选择“全部保留作者”或“全部保留自己”。
5. 合并后必须执行 `npm install`。
6. 必须运行 lint、类型检查和正式构建。
7. 必须在浏览器测试 `http://localhost:3000`。
8. 确认正常后才推送 `custom/main`。
9. 不要随意使用 `git reset --hard` 或强制推送。
10. 冲突看不懂时先执行 `git merge --abort`。

---

## 十三、以后可以直接这样告诉 Codex

你可以直接说：

```text
检查 agegr/pi-web 有没有更新。如果有，先备份我的 custom/main，
再把 upstream/main 同步到 main，然后合并到 custom/main。
保留我的 3000 端口和现有二次开发功能，解决冲突，
完成 npm install、lint、类型检查、build 和浏览器测试，
确认正常后提交并推送到我的私有仓库。
```

这样 Codex 会按完整流程处理，而不是只执行一次 `git pull`。

---

*文档版本：2026-06-08*  
*适用本地目录：`/Users/ethansun/Projects/pi-web`*
