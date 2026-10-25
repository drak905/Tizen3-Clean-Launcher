import subprocess
from pathlib import Path


def test_restore_script_exists_and_passes_dry_run():
    script = Path("scripts/restore_tv.ps1")
    assert script.exists()
    r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script), "-DryRun"],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
    assert "Verifying baseline backup SHA-256 checksums" in r.stdout
    assert "uninstall AppleTVDoc" in r.stdout
