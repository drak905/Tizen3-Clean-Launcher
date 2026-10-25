import pytest
import json
import os
import subprocess
import urllib.request

TV_IP = os.environ.get("TV_IP", "")
pytestmark = pytest.mark.skipif(not TV_IP, reason="needs a TV: set TV_IP (and PC_IP)")
PC_IP = os.environ.get("PC_IP", "")
SDB_BIN = os.environ.get("SDB_BIN", "./tools/sdb.exe")


def _device():
    with urllib.request.urlopen(f"http://{TV_IP}:8001/api/v2/", timeout=5) as r:
        assert r.status == 200
        return json.loads(r.read().decode("utf-8")).get("device", {})


def test_tv_and_pc_ip_configured():
    assert TV_IP != "", "TV_IP is not set."
    assert PC_IP != "", "PC_IP is not set."


def test_tizen_api_v2_reachable_and_matches_ua43m5503():
    d = _device()
    assert "UA43M5503" in d.get("modelName", "")
    assert d.get("OS") == "Tizen"


def test_developer_mode_enabled_and_host_ip_whitelisted():
    d = _device()
    assert str(d.get("developerMode")) == "1"
    assert d.get("developerIP") == PC_IP


def test_sdb_connected_to_tv():
    r = subprocess.run([SDB_BIN, "devices"], capture_output=True, text=True, timeout=10)
    assert f"{TV_IP}:26101" in r.stdout and "device" in r.stdout, r.stdout
