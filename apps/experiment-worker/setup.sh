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
$elevate docker compose --env-file .env -p triviality-experiments -f compose.yml up --build -d --wait --wait-timeout 120
echo 'Experiment service deployed. Port 8090 is private to the VM.'
