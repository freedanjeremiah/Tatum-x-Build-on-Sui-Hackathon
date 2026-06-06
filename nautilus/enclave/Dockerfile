# Multi-stage build for the Reef confidential-compute Nitro enclave (Nautilus).
#
# Stage 1 compiles the Rust nautilus-server (reef-compute feature) against the same
# glibc as the Node runtime stage. Stage 2 assembles the EIF rootfs: Node + the
# bundled in-enclave TS worker (worker/enclave-server.ts) + the Rust binary + an
# init that wires loopback, the worker, and the vsock<->TCP bridge.
#
# Built into an EIF with:  nitro-cli build-enclave --docker-uri reef-enclave:latest
# Build context = the nautilus/ directory.

# ---- Stage 1: Rust builder ----
FROM rust:1.88-slim-bookworm AS rust-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config libssl-dev git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY src/nautilus-server /build/nautilus-server
WORKDIR /build/nautilus-server
RUN cargo build --locked --no-default-features --features reef-compute --release \
    && cp target/release/nautilus-server /build/nautilus-server-bin

# ---- Stage 2: Runtime / EIF rootfs ----
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
        socat iproute2 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# In-enclave TS worker bundle + the Walrus WASM it imports (see build-bundle.sh).
COPY enclave/dist/enclave-bundle.cjs /app/enclave-bundle.cjs
COPY enclave/dist/walrus_wasm_bg.wasm /app/walrus_wasm_bg.wasm

# Rust enclave server + its health-check endpoint allowlist.
COPY --from=rust-builder /build/nautilus-server-bin /app/nautilus-server
COPY src/nautilus-server/src/apps/reef-compute/allowed_endpoints.yaml /app/allowed_endpoints.yaml

COPY enclave/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh /app/nautilus-server

# Runtime config for the in-enclave worker. Non-secret testnet values + the signer
# key are injected at build time via --build-arg (sourced from .env.local), so no
# secret lives in the committed Dockerfile. NOTE: a production enclave should
# deliver WALLET_PRIVATE_KEY over the Nautilus vsock secrets channel (port 7777)
# instead of baking it into the image; build-arg injection is used here for a
# self-contained, operator-controlled demo on this box.
ARG WALLET_PRIVATE_KEY
ARG REEF_PACKAGE_ID
ARG SEAL_KEY_SERVER_IDS
ENV WORKER_PORT=7070 \
    WORKER_ISOLATION_MODE=enclave-nautilus \
    ENCLAVE_HTTPS_PROXY=http://127.0.0.1:8888 \
    SUI_NETWORK=testnet \
    SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443 \
    WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space \
    WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space \
    SEAL_THRESHOLD=2 \
    STORAGE_EPOCHS=5 \
    WALLET_PRIVATE_KEY=$WALLET_PRIVATE_KEY \
    REEF_PACKAGE_ID=$REEF_PACKAGE_ID \
    NEXT_PUBLIC_OV_REEF_PACKAGE_ID=$REEF_PACKAGE_ID \
    SEAL_KEY_SERVER_IDS=$SEAL_KEY_SERVER_IDS
CMD ["/app/entrypoint.sh"]
