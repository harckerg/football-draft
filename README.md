# FOOTBALL DRAFT · 足球分队系统

录入球员姓名 → 自定球队数量 → **拖拽**把球员分进各支球队。
纯前端单页应用：**不需要服务器、不需要数据库、不需要构建**，把文件夹丢到任何静态托管上就能用。

界面是足球主题：夜间球场背景、记分牌 HUD、每支球队都是一块带中圈和草坪条纹的小球场，球员是带号码和球衣配色的名牌。

## 本地打开

直接双击 `index.html` 就行（`file://` 协议下所有功能都可用）。

想用本地服务器打开（更接近线上环境）：

```bash
python -m http.server 8000
# 然后访问 http://localhost:8000
```

## 部署到外网（三选一，都免费）

### 1. Cloudflare Pages（推荐）

1. 注册 [Cloudflare](https://dash.cloudflare.com/) 账号
2. 左侧 **Workers & Pages** → **Create** → **Pages** → **Upload assets**
3. 项目名填 `football-draft`，把本项目文件夹里的 `index.html`、`assets/`、`robots.txt` 拖进去
4. 点 **Deploy site**，几十秒后拿到 `https://football-draft.pages.dev`

之后改代码重新上传即可。想用 Git 自动部署就选 **Connect to Git**，构建命令留空、输出目录填 `/`。

### 2. GitHub Pages

```bash
cd 分队系统
git init
git add .
git commit -m "feat: football draft static site"
git branch -M main
git remote add origin https://github.com/<你的用户名>/football-draft.git
git push -u origin main
```

然后仓库 **Settings → Pages** → Source 选 `Deploy from a branch` → 分支 `main`、目录 `/ (root)` → Save。
一两分钟后访问 `https://<你的用户名>.github.io/football-draft/`。

> 注意：GitHub Pages 对中文路径和文件名不友好，本项目全部用英文文件名，可以直接用。

### 3. Netlify Drop（最快，不用注册也能试）

打开 <https://app.netlify.com/drop>，把整个文件夹拖进网页，立刻得到一个临时网址。
注册后可保留站点并改名。

## 功能

- **填名单**：输入框回车即加；支持一次粘贴多个名字（换行 / 逗号 / 顿号 / 分号分隔）；自动去重；支持搜索
- **定队数**：`− 2 +` 步进或直接输入，范围 2–12 支；增删球队时球员自动归位（删掉的队里的人回到替补席）
- **拖拽分队**：从左侧名单或替补席把球员拖到任意球场，也可以拖回替补席重新分配
  - 触屏设备上左右拖动即可拖拽，上下滑动仍是滚动页面
  - 不方便拖拽时：点一下球员选中，再点目标球场同样可以入队（键盘 Enter 选中 / Esc 取消）
- **⚡ 随机分队**：把替补球员随机、均衡地分进各队；已分完时再点会打乱重分
- **🔗 分享**：生成一条带着当前名单和分队的链接，对方打开是**只读预览**，点「复制到我的名单」就能接着改
- **撤销**（Ctrl+Z，最多 60 步）/ **导出**纯文本名单 / **备份与导入** JSON / **重置**
- **响应式**：窄屏自动变成单列，替补席移到最下方

## 数据存在哪里

**只存在你自己的浏览器里**（`localStorage`，键名 `football-draft:state:v1`），不上传任何服务器。

- 换浏览器、换设备、清理浏览器数据都会看不到原来的名单 → 重要数据请用「分享」对话框里的**下载备份**留一份
- 无痕模式下 localStorage 可能不可用，页面会提示「存不下」
- 分享链接把数据编码在 `#` 后面的片段里，**不会发给服务器**（`#` 部分浏览器根本不会传输）

## 目录结构

```
index.html          页面结构（记分牌 / 名单 / 分组板 / 替补席 / 对话框）
assets/style.css    球场、记分牌、球员卡等全部样式与响应式布局
assets/app.js       名单管理、拖拽、随机分队、撤销、本地保存、分享/导入
robots.txt
legacy-flask/       早期 Flask 版本（含服务端持久化），已不再需要，留作参考
```

## 从 Flask 版迁移

`legacy-flask/` 是改造前的版本：有 Flask 后端、`data/state.json` 服务端存储、多人共用一份数据。
如果你之前用它存过数据，那份 `data/state.json` 里的 `players` / `teams` / `pool` 结构与现在兼容，
可以直接改写成备份 JSON（`{"state": {...}}`）后用「导入备份」读进来。
