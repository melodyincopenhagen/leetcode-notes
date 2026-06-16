#!/bin/bash
# 启动 LeetCode Notes (server + client) 并打开浏览器
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/.logs"
mkdir -p "$LOG_DIR"

# 让 PATH 能找到 node/npm（双击 .app 时 PATH 很干净）
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# 如果端口已被占用则跳过启动
port_in_use() { lsof -iTCP:"$1" -sTCP:LISTEN -n -P >/dev/null 2>&1; }

if ! port_in_use 3001; then
  echo "[start] starting server..."
  (cd "$PROJECT_DIR/server" && nohup node index.js > "$LOG_DIR/server.log" 2>&1 &)
else
  echo "[start] server port already in use, skip"
fi

if ! port_in_use 3000; then
  echo "[start] starting client..."
  (cd "$PROJECT_DIR/client" && BROWSER=none nohup npm start > "$LOG_DIR/client.log" 2>&1 &)
else
  echo "[start] client port already in use, skip"
fi

# 等待 client 起来再开浏览器
for i in {1..60}; do
  if curl -s http://localhost:3000 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

open "http://localhost:3000"
