#!/usr/bin/env python3
"""Find Samsung TVs on the local network via SSDP and print their :8001 REST API summary."""
import json
import socket
import urllib.request


def local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))   # no packet is sent; this only picks the outgoing interface
        return s.getsockname()[0]
    finally:
        s.close()


def main() -> None:
    pc = local_ip()
    msg = ("M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\n"
           "MX: 2\r\nST: ssdp:all\r\n\r\n").encode()
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    s.bind((pc, 0))
    s.settimeout(5)
    s.sendto(msg, ("239.255.255.250", 1900))
    found = {}
    try:
        while True:
            data, addr = s.recvfrom(4096)
            server = next((l for l in data.decode(errors="ignore").splitlines() if l.lower().startswith("server:")), "")
            found.setdefault(addr[0], server)
    except socket.timeout:
        pass
    print(f"This PC: {pc}")
    for ip, server in found.items():
        if "samsung" not in server.lower():
            continue
        try:
            with urllib.request.urlopen(f"http://{ip}:8001/api/v2/", timeout=3) as r:
                d = json.loads(r.read().decode()).get("device", {})
            print(f"TV {ip}: {d.get('modelName')} {d.get('OS')} developerMode={d.get('developerMode')} developerIP={d.get('developerIP')}")
        except Exception:
            print(f"Samsung device {ip}: {server}")


if __name__ == "__main__":
    main()
