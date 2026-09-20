#!/bin/sh
# Executed over SSH by experiments:setup on an Ubuntu VM.
set -eu
cd "$HOME/triviality-experiments"
chmod 600 .env
if [ "$(id -u)" -eq 0 ]; then
    elevate=""
else
    elevate="sudo -n"
fi
if ! command -v docker >/dev/null 2>&1 || ! $elevate docker compose version >/dev/null 2>&1; then
    echo 'Installing Docker and Compose on the VM...'
    $elevate apt-get update -qq
    $elevate apt-get install -y docker.io docker-compose-v2
fi
$elevate systemctl enable --now docker
set --
if grep -q '^WORKER_DOMAIN=.' .env; then
    set -- --profile https
fi
$elevate docker compose --env-file .env -p triviality-experiments -f compose.yml "$@" up --build -d --wait --wait-timeout 120
echo 'Worker stays running after SSH disconnects and restarts with the VM.'
