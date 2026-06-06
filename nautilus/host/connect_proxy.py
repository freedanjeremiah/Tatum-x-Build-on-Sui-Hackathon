#!/usr/bin/env python3
# HTTP CONNECT forward proxy. Listens on TCP or AF_VSOCK and tunnels CONNECT
# requests out to the real internet (host-side DNS + dial). Used to give the Nitro
# enclave outbound HTTPS: the in-enclave Node worker points undici at this proxy
# (over a vsock forwarder), and TLS stays end-to-end (we only tunnel bytes).
#
#   --mode vsock --port 8888    (host: enclave reaches it at vsock CID 3:8888)
#   --mode tcp   --port 8888    (local pre-flight test)
import argparse, socket, threading, sys

def pipe(a, b):
    try:
        while True:
            d = a.recv(65536)
            if not d: break
            b.sendall(d)
    except Exception:
        pass
    finally:
        for s in (a, b):
            try: s.shutdown(socket.SHUT_RDWR)
            except Exception: pass
        for s in (a, b):
            try: s.close()
            except Exception: pass

def handle(client):
    try:
        client.settimeout(30)
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = client.recv(4096)
            if not chunk: client.close(); return
            buf += chunk
            if len(buf) > 65536: client.close(); return
        line = buf.split(b"\r\n", 1)[0].decode("latin1")
        parts = line.split()
        if len(parts) < 2 or parts[0].upper() != "CONNECT":
            client.sendall(b"HTTP/1.1 405 Method Not Allowed\r\n\r\n"); client.close(); return
        hostport = parts[1]
        host, _, port = hostport.partition(":")
        port = int(port or "443")
        try:
            remote = socket.create_connection((host, port), timeout=30)
        except Exception as e:
            client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
            print(f"[proxy] dial fail {hostport}: {e}", flush=True); client.close(); return
        client.sendall(b"HTTP/1.1 200 Connection established\r\n\r\n")
        client.settimeout(None)
        threading.Thread(target=pipe, args=(client, remote), daemon=True).start()
        threading.Thread(target=pipe, args=(remote, client), daemon=True).start()
    except Exception as e:
        print(f"[proxy] handle error: {e}", flush=True)
        try: client.close()
        except Exception: pass

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["tcp", "vsock"], default="vsock")
    ap.add_argument("--port", type=int, default=8888)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    if a.mode == "vsock":
        ls = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
        ls.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        ls.bind((socket.VMADDR_CID_ANY, a.port))
    else:
        ls = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        ls.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        ls.bind((a.host, a.port))
    ls.listen(128)
    print(f"[proxy] CONNECT proxy up: {a.mode}:{a.port}", flush=True)
    while True:
        c, _ = ls.accept()
        threading.Thread(target=handle, args=(c,), daemon=True).start()

if __name__ == "__main__":
    main()
