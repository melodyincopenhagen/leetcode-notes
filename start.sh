#!/bin/bash
echo "启动 LeetCode Notes 后端服务..."
cd "$(dirname "$0")/server"
node index.js
