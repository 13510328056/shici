#!/bin/bash
# 中国古诗词文化互动平台 — 开发环境初始化脚本
# 适用: OpenCloudOS 9.4 (CentOS 9)
# 用法: bash setup-env.sh

set -euo pipefail

log() { echo -e "\n[$(date '+%H:%M:%S')] \033[1;32m$1\033[0m"; }
warn() { echo -e "\n[$(date '+%H:%M:%S')] \033[1;33m⚠ $1\033[0m"; }

# ─── 1. 系统基础优化 ─────────────────────────────────
log "添加 Swap (2G)..."
if ! swapon --show | grep -q /swapfile; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log "Swap 已添加"
else
    warn "Swap 已存在"
fi

# ─── 2. 系统依赖 ─────────────────────────────────────
log "安装系统依赖..."
dnf install -y -q git curl wget gcc make g++ unzip tar

# ─── 3. Docker Compose (如果未安装) ──────────────────
if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
    log "安装 Docker Compose..."
    curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# ─── 4. 启动 PostGIS + Redis ─────────────────────────
log "启动 Docker 容器 (PostGIS + Redis)..."
cd /opt/poetryspace/deploy
docker compose up -d

# 等待 PostgreSQL 就绪
log "等待 PostgreSQL 就绪..."
for i in $(seq 1 30); do
    if docker exec poetryspace-postgis pg_isready -U poetry -d poetry_space &>/dev/null; then
        log "PostgreSQL 就绪"
        break
    fi
    sleep 2
done

# ─── 5. Node.js 20 ───────────────────────────────────
if ! command -v node &>/dev/null; then
    log "安装 Node.js 20 LTS..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y -q nodejs
    log "Node.js $(node --version) 已安装"
    log "npm $(npm --version) 已安装"
fi

# ─── 6. Python 依赖 ──────────────────────────────────
log "安装 Python 后端依赖..."
cd /opt/poetryspace/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --quiet --upgrade pip setuptools wheel
pip install --quiet -r requirements.txt
log "Python 依赖安装完成"

# ─── 7. 验证 ─────────────────────────────────────────
log "========== 环境验证 =========="
echo "Python:    $(python3 --version 2>/dev/null || echo 'not found')"
echo "Node:      $(node --version 2>/dev/null || echo 'not found')"
echo "Docker:    $(docker --version 2>/dev/null || echo 'not found')"
echo "PostGIS:   $(docker exec poetryspace-postgis psql -U poetry -d poetry_space -c 'SELECT PostGIS_Version();' 2>/dev/null | tail -3 | head -1 || echo 'checking...')"
echo "Redis:     $(docker exec poetryspace-redis redis-cli -a RedisPass2024! ping 2>/dev/null || echo 'checking...')"
echo "Swap:      $(free -h | grep Swap)"
echo "Disk:      $(df -h / | tail -1 | awk '{print $3 \"/\" $2 \" used (\" $5 \")\"}')"
log "========== 环境初始化完成 =========="
