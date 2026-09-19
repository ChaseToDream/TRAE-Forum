# 从零配置指南

本文档将引导你从零开始配置 TRAE-Forum 项目，包括环境准备、数据爬取、自动更新和线上部署。

> 📖 如果你想快速了解项目功能，请返回 [README.md](./README.md)

---

## 📑 目录

| 步骤 | 内容 | 说明 |
|:----:|------|------|
| 1 | [环境准备](#1-环境准备) | Python、Git、账号注册 |
| 2 | [获取项目代码](#2-获取项目代码) | Fork 或克隆仓库 |
| 3 | [本地运行与数据爬取](#3-本地运行与数据爬取) | 安装依赖、首次爬取、本地预览 |
| 4 | [配置 GitHub Actions Secret](#4-配置-github-actions-secret) | 让工作流知道你的论坛用户名 |
| 5 | [部署到线上](#5-部署到线上) | Cloudflare Pages 或 GitHub Pages |
| 6 | [自定义配置](#6-自定义配置) | 分类、主题、频率、爬取参数 |
| 7 | [故障排除](#7-故障排除) | 常见错误及解决方法 |

---

## 1. 环境准备

### 1.1 安装 Python

项目需要 **Python 3.8+**。

<table>
<tr>
<td width="33%">

**🪟 Windows**

1. 前往 [python.org](https://www.python.org/downloads/) 下载
2. 安装时勾选 **Add Python to PATH**
3. 验证：

```powershell
python --version
```

</td>
<td width="33%">

**🍎 macOS**

```bash
brew install python3
python3 --version
```

</td>
<td width="33%">

**🐧 Linux**

```bash
sudo apt update
sudo apt install python3 python3-pip
python3 --version
```

</td>
</tr>
</table>

### 1.2 安装 Git

<table>
<tr>
<td width="33%">

**🪟 Windows**

从 [git-scm.com](https://git-scm.com/download/win) 下载安装

</td>
<td width="33%">

**🍎 macOS**

```bash
brew install git
```

</td>
<td width="33%">

**🐧 Linux**

```bash
sudo apt install git
```

</td>
</tr>
</table>

验证安装：

```bash
git --version
```

### 1.3 注册必要账号

| 账号 | 用途 | 注册地址 |
|:-----|:-----|:---------|
| GitHub | 托管代码、自动更新、部署 | [github.com](https://github.com/) |
| TRAE 论坛 | 获取帖子数据 | [forum.trae.cn](https://forum.trae.cn/) |
| Cloudflare | Cloudflare Pages 部署（可选） | [cloudflare.com](https://www.cloudflare.com/) |

### 1.4 获取论坛用户名

登录 [TRAE 论坛](https://forum.trae.cn/)，点击右上角头像进入个人主页，URL 中的路径即为你的用户名：

```
https://forum.trae.cn/u/JasonShane/summary
                        ^^^^^^^^^^
                        这就是你的用户名
```

---

## 2. 获取项目代码

<table>
<tr>
<td width="50%">

### 🍴 方式一：Fork（推荐）

Fork 后你将拥有独立副本，可以自由修改并享受 GitHub Actions 自动更新。

1. 访问项目仓库页面
2. 点击右上角 **Fork** 按钮
3. 保持默认设置，点击 **Create fork**
4. 克隆到本地：

```bash
git clone https://github.com/你的用户名/TRAE-Forum.git
cd TRAE-Forum
```

</td>
<td width="50%">

### 📥 方式二：克隆后推送

适合不想 Fork 的用户：

```bash
git clone https://github.com/ChaseToDream/TRAE-Forum.git
cd TRAE-Forum

# 移除原始远程仓库，添加你自己的
git remote rename origin upstream
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

</td>
</tr>
</table>

---

## 3. 本地运行与数据爬取

### 3.1 安装 Python 依赖

```bash
pip install -r requirements.txt
```

| 依赖 | 用途 |
|:-----|:-----|
| `aiohttp` | 异步 HTTP 请求，爬虫核心依赖 |
| `tqdm` | 终端进度条显示 |
| `pydantic` | 数据模型校验 |

### 3.2 首次爬取数据

设置环境变量并运行脚本：

<table>
<tr>
<td width="50%">

**🪟 Windows PowerShell**

```powershell
$env:FORUM_USERNAME="你的论坛用户名"
python scripts/fetch_posts.py
```

</td>
<td width="50%">

**🍎🐧 macOS / Linux**

```bash
export FORUM_USERNAME="你的论坛用户名"
python3 scripts/fetch_posts.py
```

</td>
</tr>
</table>

脚本执行过程如下：

```
[1/4] 获取论坛分类列表...
  顶层大类: 14 个, 子分类: 2 个
  已排除分类: Bug 反馈, 产品建议
[2/4] 获取用户信息...
  用户: JasonShane (ID: 903)
[3/4] 获取用户帖子列表...
  第 1 页: 30 条新帖子
  第 2 页: 16 条新帖子
  共获取 46 条帖子
[4/4] 强制刷新所有帖子详情...
  刷新帖子详情: 100%|██████████| 46/46
  成功刷新 46/46 条帖子详情

=== 完成 ===
  有效帖子: 39
  已排除: 7 (Bug 反馈, 产品建议)
  分类统计: {"技巧分享": 10, "互动交流": 18, ...}
  输出文件: /path/to/TRAE-Forum/data/posts.json
```

### 3.3 本地预览

直接用浏览器打开项目根目录的 `index.html` 文件即可预览。

<table>
<tr>
<td width="33%">

**🪟 Windows**

```powershell
start index.html
```

</td>
<td width="33%">

**🍎 macOS**

```bash
open index.html
```

</td>
<td width="33%">

**🐧 Linux**

```bash
xdg-open index.html
```

</td>
</tr>
</table>

> ⚠️ 部分浏览器可能阻止 AJAX 请求本地文件，如遇此问题可使用本地服务器：
>
> ```bash
> python -m http.server 8080
> # 然后访问 http://localhost:8080
> ```

### 3.4 提交初始数据

确认数据正确后，将 `posts.json` 提交到仓库：

```bash
git add data/posts.json
git commit -m "feat: add initial posts data"
git push
```

---

## 4. 配置 GitHub Actions Secret

这一步让 GitHub Actions 工作流知道要爬取哪个用户的数据。

1. 进入你的 GitHub 仓库页面
2. 点击 **Settings** 标签
3. 左侧菜单选择 **Secrets and variables → Actions**
4. 点击 **New repository secret**
5. 填写：
   - **Name**：`FORUM_USERNAME`
   - **Value**：你的论坛用户名（如 `JasonShane`）
6. 点击 **Add secret**

配置完成后，手动触发一次验证：

1. 进入仓库的 **Actions** 标签
2. 左侧选择 **Update Forum Posts** 工作流
3. 点击 **Run workflow** → **Run workflow**
4. 等待运行完成，检查是否成功提交了新的 `posts.json`

> ⚠️ Fork 的仓库首次需要在 Actions 页面手动启用工作流，GitHub 会显示一个确认提示。

---

## 5. 部署到线上

选择以下任一平台部署，两者均**免费且无需构建步骤**。

<table>
<tr>
<td width="50%">

### ☁️ Cloudflare Pages（推荐）

全球 CDN 加速，访问速度更快

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 点击 **Create application → Pages → Connect to Git**
4. 授权并选择你的 GitHub 仓库
5. 配置构建设置：
   - **Production branch**：`main`
   - **Build command**：留空
   - **Build output directory**：`/`
   - **Root directory**：`/`
6. 点击 **Save and Deploy**
7. 等待部署完成，分配 `xxx.pages.dev` 域名

每次 GitHub Actions 提交新数据，Cloudflare 会自动检测并重新部署。

</td>
<td width="50%">

### 🐙 GitHub Pages

零配置，一键启用

1. 进入仓库 **Settings → Pages**
2. **Source** 选择 `Deploy from a branch`
3. **Branch** 选择 `main`，目录选 `/ (root)`
4. 点击 **Save**
5. 等待几分钟，访问地址：`https://你的用户名.github.io/TRAE-Forum/`

> 更新可能需要 1-3 分钟生效

</td>
</tr>
</table>

---

## 6. 自定义配置

### 6.1 调整分类可见性

编辑 [config.json](./config.json)，将不需要展示的分类设为 `visible: false`：

```json
{
  "categories": {
    "技巧分享": { "color": "#0066FF", "soft": "#E8F0FE", "icon": "💡", "visible": true },
    "Bug 反馈": { "color": "#9499B3", "soft": "#EEF0F6", "icon": "🐛", "visible": false },
    "产品建议": { "color": "#25AAE2", "soft": "#E6F5FC", "icon": "📝", "visible": false }
  }
}
```

修改后需重新运行爬取脚本使配置生效。

### 6.2 修改分类配色和图标

| 字段 | 说明 | 示例 |
|:-----|:-----|:-----|
| `color` | 主色，用于分类标签和标题 | `#0066FF` |
| `soft` | 浅色，用于背景和徽章 | `#E8F0FE` |
| `icon` | 分类图标，支持 Emoji | `💡` |

### 6.3 修改页面主题

编辑 [styles.css](./styles.css) 中 `:root` 下的 CSS 变量：

```css
:root {
  --accent: #4F6EF7;        /* 主强调色 */
  --accent-soft: #EEF1FE;   /* 主强调色浅色 */
  --bg: #F0F2F8;            /* 页面背景色 */
  --text-primary: #1E2432;  /* 主文字色 */
  /* 更多变量见 styles.css */
}
```

### 6.4 调整自动更新频率

编辑 [.github/workflows/update.yml](./.github/workflows/update.yml) 中的 cron 表达式：

```yaml
on:
  schedule:
    - cron: '0 */2 * * *'   # 每 2 小时运行一次
```

| 频率 | cron 表达式 |
|:-----|:------------|
| 每 2 小时 | `0 */2 * * *` |
| 每 4 小时 | `0 */4 * * *` |
| 每天一次 | `0 2 * * *` |
| 每周一 | `0 2 * * 1` |

> 💡 cron 使用 UTC 时区，北京时间需减 8 小时。例如北京时间 10:00 = UTC 02:00。

### 6.5 调整爬取参数

编辑 [scripts/fetch_posts.py](./scripts/fetch_posts.py) 顶部的常量：

| 常量 | 默认值 | 说明 |
|:-----|:-------|:-----|
| `REQUEST_DELAY` | `1.0` | 每次请求间隔（秒），防止触发限流 |
| `MAX_RETRIES` | `3` | 请求失败重试次数 |
| `CONCURRENCY` | `5` | 异步并发数 |
| `MAX_PAGES` | `200` | 最大翻页数 |

---

## 7. 故障排除

### 脚本运行报错

| 错误信息 | 原因 | 解决方法 |
|:---------|:-----|:---------|
| `请设置环境变量 FORUM_USERNAME` | 未设置环境变量 | 参见 [3.2 首次爬取数据](#32-首次爬取数据) |
| `无法获取用户信息` | 用户名不存在 | 检查用户名拼写，参见 [1.4 获取论坛用户名](#14-获取论坛用户名) |
| `请求失败 (尝试 3/3)` | 网络问题或论坛限流 | 检查网络连接，或增大 `REQUEST_DELAY` 值 |
| `ModuleNotFoundError: No module named 'aiohttp'` | 未安装依赖 | 运行 `pip install -r requirements.txt` |

### GitHub Actions 问题

<details>
<summary><strong>工作流未自动运行</strong></summary>

1. Fork 的仓库需要先在 Actions 页面手动启用
2. 确认 `FORUM_USERNAME` Secret 已正确配置
3. 确认工作流文件在 `main` 分支上
4. 尝试手动触发：Actions → Update Forum Posts → Run workflow

</details>

<details>
<summary><strong>工作流运行但数据未更新</strong></summary>

1. 检查 Actions 运行日志，确认脚本是否正常执行
2. 可能是论坛数据确实没有变化（工作流会检测差异，无变化则不提交）

</details>

### 部署问题

<details>
<summary><strong>页面一直显示「正在加载数据...」</strong></summary>

1. 确认 `data/posts.json` 文件已提交到仓库
2. 用浏览器开发者工具（F12）检查 Network 面板，确认 `posts.json` 和 `config.json` 是否返回 404
3. 如果是本地文件预览，部分浏览器可能阻止 AJAX 请求本地文件，可使用本地服务器：

```bash
python -m http.server 8080
# 然后访问 http://localhost:8080
```

</details>

<details>
<summary><strong>Cloudflare Pages 部署后样式异常</strong></summary>

- 确认 Build output directory 设置为 `/`
- 确认所有文件（包括 `data/` 目录）都已提交到仓库

</details>

---

## 完整流程回顾

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 环境准备  │ ─▶│ 获取代码  │ ─▶│ 安装依赖  │ ─▶│ 设置变量  │ ─▶│ 运行脚本  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                                  │
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│ 自动更新  │ ◀─│ 部署上线  │ ◀─│ 配置密钥  │ ◀─│ 提交数据  │ ◀──────┘
└──────────┘   └──────────┘   └──────────┘   └──────────┘
```

遇到问题可参考上方故障排除，或回到 [README.md](./README.md) 查看项目概览和常见问题。
