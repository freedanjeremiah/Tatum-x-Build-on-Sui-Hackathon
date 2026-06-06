#!/bin/sh
# Enclave init. Brings up loopback, wires the outbound egress proxy + inbound
# bridge over vsock, starts the in-enclave TS worker, then launches the Rust
# nautilus-server (reef-compute) which serves /get_attestation + /process_data.
set -e

echo "[enclave] bringing up loopback"
ip addr add 127.0.0.1/8 dev lo 2>/dev/null || true
ip link set dev lo up 2>/dev/null || true
echo "127.0.0.1 localhost" > /etc/hosts

# Outbound egress: the enclave has no direct internet route. Forward local TCP
# 127.0.0.1:8888 to the parent's vsock CONNECT proxy (CID 3, port 8888). The Node
# worker points undici (ENCLAVE_HTTPS_PROXY) at 127.0.0.1:8888, so Seal / Walrus /
# Sui calls tunnel out through the host. TLS stays end-to-end.
echo "[enclave] outbound proxy forwarder 127.0.0.1:8888 -> vsock(3:8888)"
socat TCP4-LISTEN:8888,bind=127.0.0.1,reuseaddr,fork VSOCK-CONNECT:3:8888 &

WORKER_PORT="${WORKER_PORT:-7070}"
echo "[enclave] starting in-enclave TS worker on 127.0.0.1:${WORKER_PORT}"
WORKER_PORT="$WORKER_PORT" \
  WORKER_ISOLATION_MODE="${WORKER_ISOLATION_MODE:-enclave-nautilus}" \
  ENCLAVE_HTTPS_PROXY="${ENCLAVE_HTTPS_PROXY:-http://127.0.0.1:8888}" \
  node /app/enclave-bundle.cjs &

# Bridge: host reaches the enclave's Rust server (TCP 3000) via vsock port 3000.
echo "[enclave] bridging vsock:3000 -> 127.0.0.1:3000"
socat VSOCK-LISTEN:3000,reuseaddr,fork TCP:127.0.0.1:3000 &

# Give the worker a moment to bind before the Rust server starts taking requests.
sleep 2

echo "[enclave] starting nautilus-server (reef-compute)"
exec /app/nautilus-server
