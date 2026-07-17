#!/usr/bin/env bash
# Install NVIDIA Container Toolkit on Ubuntu/Debian and wire it into Docker.
# Requires: sudo, NVIDIA driver already working (nvidia-smi), Docker installed.
set -euo pipefail

if ! command -v nvidia-smi >/dev/null; then
  echo "ERROR: nvidia-smi not found. Install the NVIDIA driver first." >&2
  exit 1
fi

if ! command -v docker >/dev/null; then
  echo "ERROR: docker not found." >&2
  exit 1
fi

echo "==> Adding NVIDIA Container Toolkit apt repository"
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

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
echo "  docker compose --profile gpu up -d ollama"
echo "  docker exec -it \$(docker ps -qf name=ollama) ollama pull qwen2.5:7b"
