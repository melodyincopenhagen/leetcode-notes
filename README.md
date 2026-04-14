# LeetCode Notes

本地刷题笔记系统，支持同步 LeetCode 已做题目、记录状态、做笔记（支持图片）、打标签、随机抽题。

## 目录结构

```
leetcode_notes/
├── server/       # Node.js 后端（Express + SQLite）
├── client/       # React 前端
├── extension/    # Chrome 插件（负责同步 LeetCode 数据）
└── start.sh      # 快速启动后端
```

## 首次使用

### 1. 启动后端

```bash
cd server
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

### 2. 启动前端

```bash
cd client
npm start
```

前端访问 http://localhost:3000

### 3. 安装 Chrome 插件

1. 打开 Chrome → 地址栏输入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/` 目录
5. 确保已登录 leetcode.com

### 4. 同步数据

- 点击 Chrome 工具栏的插件图标 → 「立即同步」
- 之后每天 12:00 自动同步（需要 Chrome 在运行）

## 功能

| 功能 | 说明 |
|------|------|
| 题目同步 | 从 LeetCode 拉取已通过题目及题目描述 |
| 状态标记 | 完全忘记 / 记得思路但写不出来 / 写出来但有小错误 / 全写对了 |
| Markdown 笔记 | 支持粘贴图片（Ctrl+V 直接粘贴截图） |
| 备注栏 | 纯文本备注 |
| 标签 | 自定义 hashtag，逗号分隔 |
| 历史记录 | 每次标记都会记录日期，可查看进步轨迹 |
| 统计 | 首页显示各状态总数 |
| 筛选 | 按难度、状态、标签、最近尝试日期筛选 |
| 随机抽题 | 在当前筛选结果中随机抽一题 |

## 数据存储

- 数据库：`server/leetcode.db`（SQLite，单文件）
- 图片：`server/uploads/`
