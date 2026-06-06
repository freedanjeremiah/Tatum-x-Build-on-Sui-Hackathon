#!/usr/bin/env python3
# Host-side bridge: TCP 127.0.0.1:LOCAL_PORT  <->  enclave AF_VSOCK (CID, VPORT).
# Lets host tooling (curl, the tsx demo) reach the Nitro enclave's HTTP server.
import socket, sys, threading

LOCAL_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
CID = int(sys.argv[2]) if len(sys.argv) > 2 else 16
VPORT = int(sys.argv[3]) if len(sys.argv) > 3 else 3000

def pipe(src, dst):
    try:
        while True:
            b = src.recv(65536)
            if not b:
                break
            dst.sendall(b)
    except Exception:
        pass
    finally:
        for s in (src, dst):
            try: s.shutdown(socket.SHUT_RDWR)
            except Exception: pass

def handle(client):
    try:
        v = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
        v.connect((CID, VPORT))
    except Exception as e:
        client.close(); print("vsock connect failed:", e, flush=True); return
    threading.Thread(target=pipe, args=(client, v), daemon=True).start()
    threading.Thread(target=pipe, args=(v, client), daemon=True).start()

def main():
    ls = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    ls.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    ls.bind(("127.0.0.1", LOCAL_PORT))
    ls.listen(128)
    print(f"bridge up: 127.0.0.1:{LOCAL_PORT} -> vsock({CID}:{VPORT})", flush=True)
    while True:
        c, _ = ls.accept()
        handle(c)

if __name__ == "__main__":
    main()
