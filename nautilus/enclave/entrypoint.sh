#!/bin/sh
# Enclave init (PID-adjacent). Brings up loopback, starts the in-enclave TS worker
# on 127.0.0.1:$WORKER_PORT, bridges host<->enclave traffic over vsock:3000, then
# launches the Rust nautilus-server (reef-compute) which serves /get_attestation
# and /process_data on 0.0.0.0:3000.
set -e

echo "[enclave] bringing up loopback"
ip addr add 127.0.0.1/8 dev lo 2>/dev/null || true
ip link set dev lo up 2>/dev/null || true
echo "127.0.0.1 localhost" > /etc/hosts

WORKER_PORT="${WORKER_PORT:-7070}"
echo "[enclave] starting in-enclave TS worker on 127.0.0.1:${WORKER_PORT}"
WORKER_PORT="$WORKER_PORT" WORKER_ISOLATION_MODE="${WORKER_ISOLATION_MODE:-enclave-nautilus}" \
  node /app/enclave-bundle.cjs &

# Bridge: host reaches the enclave's Rust server (TCP 3000) via vsock port 3000.
echo "[enclave] bridging vsock:3000 -> 127.0.0.1:3000"
socat VSOCK-LISTEN:3000,reuseaddr,fork TCP:127.0.0.1:3000 &

# Give the worker a moment to bind before the Rust server starts taking requests.
sleep 2

echo "[enclave] starting nautilus-server (reef-compute)"
exec /app/nautilus-server
