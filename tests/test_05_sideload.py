import pytest
import os
import subprocess

TV_IP = os.environ.get("TV_IP", "")
pytestmark = pytest.mark.skipif(not TV_IP, reason="needs a TV: set TV_IP (and PC_IP)")
SDB_BIN = os.environ.get("SDB_BIN", "./tools/sdb.exe")


def test_appletv_dock_installed_on_tizen_tv():
    out = subprocess.run([SDB_BIN, "-s", f"{TV_IP}:26101", "shell", "0", "applist"],
                         capture_output=True, text=True, timeout=20, check=True).stdout
    assert "AppleTVDoc" in out, "AppleTVDock.wgt is not installed on the TV"
