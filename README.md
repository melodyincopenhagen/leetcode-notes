# LeetCode Notes

本地刷题笔记系统，支持从 LeetCode 同步已做题目、记录做题状态、写 Markdown 笔记、管理独立笔记本、查看刷题热力图。

## 目录结构

```
leetcode_notes/
├── server/       # Node.js 后端（Express + SQLite）
├── client/       # React 前端
├── extension/    # Chrome 插件（从浏览器同步 LeetCode 数据）
└── start.sh      # 快速启动后端
```

## 首次使用

### 1. 配置 LeetCode Session

```bash
cp server/config.example.json server/config.json
```

编辑 `server/config.json`，填入你的 LeetCode session cookie。

获取方式：登录 leetcode.com → 打开开发者工具 → Application → Cookies → 复制 `LEETCODE_SESSION` 的值。

### 2. 启动后端

```bash
cd server
npm install
node index.js
# 或者直接运行 ./start.sh
```

后端监听 http://localhost:3001

**设置开机自启（推荐）：**

```bash
npm install -g pm2
cd server
pm2 start index.js --name leetcode-notes
pm2 startup   # 按提示执行输出的命令
pm2 save
```

### 3. 启动前端

```bash
cd client
npm install
npm start
```

前端访问 http://localhost:3000

### 4. 安装 Chrome 插件（可选）

1. 打开 Chrome → 地址栏输入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/` 目录
5. 确保已登录 leetcode.com

### 5. 同步数据

有两种方式同步 LeetCode 题目：
- **网页端**：首页点击「同步题目」按钮
- **Chrome 插件**：点击工具栏插件图标 →「立即同步」
- 后端每天 12:00 自动同步一次（需保持后端运行）

## 功能

### 题目管理

| 功能 | 说明 |
|------|------|
| 题目同步 | 从 LeetCode 拉取已通过题目、题目描述 |
| 题目搜索 | 按题号或题目名称搜索 |
| 筛选排序 | 按难度、状态、标签筛选，支持按题号/标题/最近尝试排序 |
| 随机抽题 | 在当前筛选结果中随机抽一题 |
| LeetCode 跳转 | 题目详情页可直接跳转到 LeetCode 原题 |

### 做题记录

| 功能 | 说明 |
|------|------|
| 状态标记 | 完全忘记 / 记得思路 / 有小错误 / 完美通过 |
| 历史记录 | 每次标记都会记录日期，可查看进步轨迹，支持删除单条记录 |
| 统计概览 | 首页显示各状态总数和进度条 |
| 热力图 | 首页展示提交热力图，类似 GitHub contribution graph |

### 笔记系统

| 功能 | 说明 |
|------|------|
| 题目笔记 | 在每道题的详情页写 Markdown 笔记，支持代码高亮 |
| 备注 | 每道题支持纯文本备注 |
| 标签 | 自定义标签，逗号分隔（如：数组, 双指针） |
| 图片粘贴 | Ctrl+V 直接粘贴截图，自动上传保存 |
| 自动保存 | 笔记编辑后 1 秒自动保存 |

### 独立笔记本

| 功能 | 说明 |
|------|------|
| 文件夹管理 | 支持创建文件夹和子文件夹，树形目录结构 |
| Markdown 编辑 | 独立笔记同样支持 Markdown 和图片粘贴 |
| 搜索 | 按标题搜索笔记 |

## 数据存储

- 数据库：`server/leetcode.db`（SQLite，单文件，已在 .gitignore 中排除）
- 图片：`server/uploads/`
- 配置：`server/config.json`（含敏感信息，已在 .gitignore 中排除）
