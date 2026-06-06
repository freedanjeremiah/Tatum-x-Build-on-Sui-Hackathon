# Host-side helpers for the Reef Nitro enclave

The enclave has no direct network route; the parent EC2 host brokers everything
over vsock. Two long-running host services (run them under systemd so they survive
SSH logout):

- **connect_proxy.py** — outbound egress. An HTTP CONNECT forward proxy listening on
  `AF_VSOCK CID_ANY:8888`. The in-enclave Node worker points undici at
  `http://127.0.0.1:8888` (forwarded to vsock 3:8888 by the enclave entrypoint), so
  Seal / Walrus / Sui calls tunnel out through the host. TLS stays end-to-end.
  `sudo systemd-run --unit=reef-egress python3 connect_proxy.py --mode vsock --port 8888`

- **vsock_bridge.py** — inbound. Forwards host `127.0.0.1:3000` to the enclave's
  vsock `CID:3000` so tooling (curl, the tsx demo, an ssh -L tunnel) can reach the
  enclave's `/get_attestation` + `/process_data`.
  `sudo systemd-run --unit=reef-bridge python3 vsock_bridge.py 3000 <CID> 3000`

Replace `<CID>` with the running enclave's CID (`nitro-cli describe-enclaves`).
