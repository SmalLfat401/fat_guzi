#!/bin/bash

# ============================================
# Fat OpenClaw Backend 启动脚本
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 激活 conda 环境
if command -v conda &> /dev/null; then
    source ~/anaconda3/etc/profile.d/conda.sh
    conda activate fat_auto_gui
elif command -v pyenv &> /dev/null; then
    eval "$(pyenv init -)"
    pyenv shell fat_auto_gui
elif command -v venv &> /dev/null; then
    source "$SCRIPT_DIR/venv/bin/activate"
fi

# 进入 server 目录
cd "$SCRIPT_DIR"

# 启动 FastAPI 服务
# uvicorn main:app --host 0.0.0.0 --port 8879 --reload
uvicorn main:app  --port 8879 --reload