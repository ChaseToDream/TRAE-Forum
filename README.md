<div align="center">

# TRAE-Forum

**自动展示个人在 [TRAE 官方中文社区](https://forum.trae.cn/) 的帖子**

支持分类筛选 · 关键词搜索 · 多视图切换 · 数据每 2 小时自动更新

[![License](https://img.shields.io/github/license/ChaseToDream/TRAE-Forum?style=flat-square)](./LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square)](./requirements.txt)
[![Update](https://img.shields.io/github/actions/workflow/status/ChaseToDream/TRAE-Forum/update.yml?style=flat-square&label=auto-update)](./.github/workflows/update.yml)

</div>

---

## 📋 导航

| 🚀 [快速开始](#-快速开始) | ⌨️ [快捷键](#-键盘快捷键) | ⚙️ [配置说明](#-配置说明) | 🌐 [部署](#-部署) |
|:---:|:---:|:---:|:---:|
| 📁 [项目结构](#-项目结构) | 🎨 [自定义](#-自定义) | 🔄 [自动更新](#-自动更新) | ❓ [常见问题](#-常见问题) |

---

## ✨ 功能特性

### 🖥️ 前端展示

| 功能 | 说明 |
|:-----|:-----|
| 📊 三视图模式 | 瀑布流分类视图 / 卡片列表视图 / 日历视图 |
| 📂 分类筛选 | 通过 `config.json` 灵活控制分类可见性 |
| 🔍 关键词搜索 | 支持搜索帖子标题、内容和分类，实时防抖 |
| 🌙 深色模式 | 支持亮色/深色主题切换，自动保存偏好 |
| ⚡ 骨架屏加载 | 优化加载体验，减少页面闪烁 |
| 📱 响应式设计 | 完美适配桌面与移动端 |
| 🔗 URL 状态同步 | 搜索、分类、排序状态可通过 URL 分享 |

### 📊 数据与交互

| 功能 | 说明 |
|:-----|:-----|
| 📊 数据统计 | 分类分布饼图、发帖时间线柱状图 |
| 📥 数据导出 | 支持导出为 CSV / JSON 格式 |
| ⌨️ 键盘快捷键 | `/` 搜索、`D` 切换主题、`S` 统计面板、`R` 刷新 |
| 🔃 页面刷新 | 页面内刷新按钮 + 5 分钟自动轮询 |

### ⚙️ 后端爬虫

| 功能 | 说明 |
|:-----|:-----|
| 🔄 自动更新 | GitHub Actions 每 2 小时自动爬取最新帖子 |
| 🚀 异步并发 | Python 爬虫使用 aiohttp 异步并发，速度提升 5x |
| 💾 增量更新 | 智能增量抓取 + 强制详情刷新，减少 API 调用 |

---

## 🚀 快速开始

### 前置条件

- Python 3.8+
- Git
- GitHub 账号
- TRAE 论坛账号

### 30 秒速览

```bash
# 1. 克隆仓库
git clone https://github.com/ChaseToDream/TRAE-Forum.git
cd TRAE-Forum

# 2. 安装依赖
pip install -r requirements.txt

# 3. 设置论坛用户名并运行
# Windows PowerShell
$env:FORUM_USERNAME="你的论坛用户名"
python scripts/fetch_posts.py

# macOS / Linux
FORUM_USERNAME=你的论坛用户名 python scripts/fetch_posts.py

# 4. 本地预览 — 用浏览器打开 index.html 即可
```

> 📖 完整配置指南请参考 **[SETUP.md](./SETUP.md)**

---

## ⌨️ 键盘快捷键

| 快捷键 | 功能 | | 快捷键 | 功能 |
|:------:|:-----|:-:|:------:|:-----|
| `/` | 聚焦搜索框 | | `D` | 切换亮色/深色主题 |
| `1` | 分类视图 | | `S` | 打开/关闭统计面板 |
| `2` | 卡片视图 | | `R` | 刷新数据 |
| `3` | 日历视图 | | `Esc` | 清除搜索 / 关闭面板 |

---

## ⚙️ 配置说明

### 环境变量

| 变量名 | 必填 | 说明 |
|--------|:----:|------|
| `FORUM_USERNAME` | ✅ | TRAE 论坛用户名，如 `JasonShane` |

### config.json 分类配置

控制每个分类的显示样式和可见性：

```json
{
  "categories": {
    "技巧分享": { "color": "#0066FF", "soft": "#E8F0FE", "icon": "💡", "visible": true },
    "产品建议": { "color": "#25AAE2", "soft": "#E6F5FC", "icon": "📝", "visible": false }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `color` | string | 分类主色，用于标签和标题 |
| `soft` | string | 分类浅色，用于背景和徽章 |
| `icon` | string | 分类图标（Emoji） |
| `visible` | boolean | `false` 则该分类的帖子不会出现 |

> 💡 脚本运行时会自动从论坛获取最新分类列表，新增分类若未在配置中声明，将使用默认样式显示。

### GitHub Actions Secret

在仓库 **Settings → Secrets and variables → Actions** 中添加：

| 名称 | 值 | 说明 |
|------|------|------|
| `FORUM_USERNAME` | 你的论坛用户名 | 工作流运行时读取此变量 |

---

## 🌐 部署

两种部署方式均**免费且无需构建步骤**，直接托管静态文件即可。

<table>
<tr>
<td width="50%">

### ☁️ Cloudflare Pages（推荐）

全球 CDN 加速，访问速度更快

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages → Create application → Pages**
3. 连接 GitHub 仓库
4. 构建设置：
   - 构建命令：留空
   - 输出目录：`/`
   - 根目录：`/`
5. 部署

</td>
<td width="50%">

### 🐙 GitHub Pages

零配置，一键启用

1. 仓库 **Settings → Pages**
2. Source 选择 `Deploy from a branch`
3. Branch 选择 `main`，目录选 `/ (root)`
4. 保存

> 更新可能需要 1-3 分钟生效

</td>
</tr>
</table>

---

## 📁 项目结构

```
TRAE-Forum/
├── index.html                  # 主页面入口
├── styles.css                  # 样式表（支持深色模式）
├── app.js                      # 前端应用逻辑
├── config.json                 # 分类显示配置（颜色、图标、可见性）
├── data/
│   └── posts.json              # 爬取的帖子数据（自动生成）
├── scripts/
│   └── fetch_posts.py          # 数据爬取脚本（异步并发）
├── requirements.txt            # Python 依赖
├── .github/workflows/
│   └── update.yml              # GitHub Actions 自动更新工作流
├── SETUP.md                    # 从零配置指南
├── UI_FEATURES.md              # UI 功能详细说明
├── OPTIMIZATION_SUMMARY.md     # 优化总结
└── LICENSE                     # MIT 许可证
```

---

## 🎨 自定义

| 自定义项 | 文件 | 说明 |
|:---------|:-----|:-----|
| 排除/显示分类 | `config.json` | 修改 `visible` 字段 |
| 分类配色和图标 | `config.json` | 修改 `color`、`soft`、`icon` 字段 |
| 页面主题配色 | `styles.css` | 修改 `:root` 下的 CSS 变量 |
| 更新频率 | `.github/workflows/update.yml` | 修改 `cron` 表达式 |
| 并发数/重试/延迟 | `scripts/fetch_posts.py` | 修改 `CONCURRENCY`、`MAX_RETRIES`、`REQUEST_DELAY` |

---

## 🔄 自动更新

GitHub Actions 工作流（[update.yml](./.github/workflows/update.yml)）配置为每 2 小时自动运行，也可在 Actions 页面手动触发。

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 爬取数据 │ ──▶│ 增量合并 │ ──▶│ 详情刷新 │ ──▶│ 检测变化 │ ──▶│ 自动提交 │ ──▶│ 自动部署 │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

前端页面还内置了 **5 分钟间隔**的自动轮询，以及手动刷新按钮，确保展示数据始终最新。

---

## ❓ 常见问题

<details>
<summary><strong>运行脚本报错「请设置环境变量 FORUM_USERNAME」</strong></summary>

需要先设置环境变量再运行脚本：

```powershell
# Windows PowerShell
$env:FORUM_USERNAME="你的用户名"

# macOS / Linux
export FORUM_USERNAME="你的用户名"
```

或在 GitHub Actions 中配置 Secret，详见 [SETUP.md - 配置 Secret](./SETUP.md#4-配置-github-actions-secret)。
</details>

<details>
<summary><strong>帖子数据为空或部分分类缺失</strong></summary>

1. 检查 `config.json` 中对应分类的 `visible` 是否为 `false`
2. 检查论坛用户名是否正确
3. 脚本运行时会输出已排除的分类名称，留意控制台日志
</details>

<details>
<summary><strong>GitHub Actions 工作流未自动运行</strong></summary>

1. 确认 `FORUM_USERNAME` Secret 已正确配置
2. 确认工作流文件在 `main` 分支上
3. Fork 的仓库需要在 Actions 页面手动启用工作流
4. 可在 Actions 页面点击 "Run workflow" 手动触发
</details>

<details>
<summary><strong>部署后页面显示「正在加载数据...」</strong></summary>

1. 确认 `data/posts.json` 文件存在且内容有效
2. 确认部署时包含 `data/` 目录
3. 浏览器控制台检查是否有跨域或 404 错误
4. 本地预览时部分浏览器可能阻止 AJAX 请求本地文件，可使用 `python -m http.server 8080` 启动本地服务器
</details>

---

## 📚 相关文档

| 文档 | 说明 |
|:-----|:-----|
| [SETUP.md](./SETUP.md) | 从零开始配置项目的完整指南 |
| [UI_FEATURES.md](./UI_FEATURES.md) | UI 功能详细说明 |
| [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md) | 项目优化总结 |
| [LICENSE](./LICENSE) | MIT 开源许可证 |

---

<div align="center">

**[MIT](./LICENSE) © 逐梦星辰**

</div>
