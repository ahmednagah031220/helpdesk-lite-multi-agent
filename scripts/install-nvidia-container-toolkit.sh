#!/usr/bin/env bash
# Install NVIDIA Container Toolkit on Ubuntu/Debian and wire it into Docker.
# Requires: sudo, NVIDIA driver already working (nvidia-smi), Docker installed.
# Safe to re-run (idempotent / non-interactive).
set -euo pipefail

if ! command -v nvidia-smi >/dev/null; then
  echo "ERROR: nvidia-smi not found. Install the NVIDIA driver first." >&2
  exit 1
fi

if ! command -v docker >/dev/null; then
  echo "ERROR: docker not found." >&2
  exit 1
fi

# Already installed + GPU works in Docker → nothing to do
if command -v nvidia-ctk >/dev/null \
  && dpkg -s nvidia-container-toolkit >/dev/null 2>&1 \
  && docker info 2>/dev/null | grep -qi nvidia; then
  echo "==> NVIDIA Container Toolkit already installed and Docker has nvidia runtime."
  echo "==> Quick check:"
  if docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi -L; then
    echo
    echo "OK — skip this script. Start Ollama with:"
    echo "  docker compose up -d ollama"
    exit 0
  fi
  echo "WARN: toolkit present but --gpus failed; reconfiguring Docker runtime..."
fi

echo "==> Adding NVIDIA Container Toolkit apt repository"
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list >/dev/null

echo "==> Installing nvidia-container-toolkit"
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

echo "==> Configuring Docker runtime"
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

echo "==> Verifying GPU inside a container"
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi

echo
echo "OK. Start project Ollama on GPU with:"
echo "  docker compose up -d ollama"
echo "  docker exec -it \$(docker ps -qf name=ollama) ollama pull qwen2.5:7b"
