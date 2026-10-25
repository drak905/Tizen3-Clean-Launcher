import pytest
import os
import socket
import subprocess
from pathlib import Path

TV_IP = os.environ.get("TV_IP", "")
SDB_BIN = os.environ.get("SDB_BIN", "./tools/sdb.exe")
DNS_SERVER = os.environ.get("DNS_SERVER", "94.140.14.14")  # AdGuard DNS (plan default); set DNS_SERVER=<router> to test another resolver


def _lines(path):
    return [l.strip() for l in Path(path).read_text().splitlines() if l.strip() and not l.startswith("#")]


def _nslookup(domain):
    return subprocess.run(["nslookup", domain, DNS_SERVER], capture_output=True, text=True, timeout=10).stdout


def test_samsung_ad_and_acr_domains_are_blocked():
    for domain in _lines("config/ad_domains_blocklist.txt"):
        out = _nslookup(domain)
        assert any(m in out for m in ("0.0.0.0", "NXDOMAIN", "can't find", "Refused")), \
            f"{domain} still resolves via {DNS_SERVER}:\n{out}"


def test_essential_streaming_and_tizen_domains_resolve():
    for domain in _lines("config/safe_domains_allowlist.txt"):
        out = _nslookup(domain)
        tail = out.split("Name:", 1)[-1] if "Name:" in out else ""
        assert tail and "0.0.0.0" not in tail, f"Essential domain {domain} blocked/unresolved via {DNS_SERVER}:\n{out}"


@pytest.mark.skipif(not TV_IP or not Path("backups/applist_baseline.txt").exists(), reason="needs TV_IP and a local baseline")
def test_zero_packages_were_uninstalled_over_sdb():
    baseline = Path("backups/applist_baseline.txt").read_text(encoding="utf-8-sig")
    live = subprocess.run([SDB_BIN, "-s", f"{TV_IP}:26101", "shell", "0", "applist"],
                          capture_output=True, text=True, timeout=20, check=True).stdout
    norm = lambda s: {l.rstrip() for l in s.splitlines() if l.strip()}
    base, now = norm(baseline), norm(live)
    assert not (base - now), f"Packages were removed: {base - now}"
    extra = {l for l in now - base if "AppleTVDoc" not in l}
    assert not extra, f"Unexpected packages added: {extra}"
