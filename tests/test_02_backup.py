import pytest
import hashlib
from pathlib import Path

BACKUP_DIR = Path("backups")
pytestmark = pytest.mark.skipif(not (BACKUP_DIR / "manifest.sha256").exists(), reason="no local baseline: run scripts/backup_tv.ps1 first")
REQUIRED_FILES = ["tv_api_v2_baseline.json", "sdb_capability_baseline.txt", "applist_baseline.txt", "manifest.sha256"]


def test_backup_files_exist_and_non_empty():
    for f in REQUIRED_FILES:
        p = BACKUP_DIR / f
        assert p.exists(), f"Missing {p}"
        assert p.stat().st_size > 50, f"{p} too small"


def test_applist_contains_core_tizen_packages():
    text = (BACKUP_DIR / "applist_baseline.txt").read_text(encoding="utf-8-sig")
    lines = [l for l in text.splitlines() if l.strip()]
    assert len(lines) >= 50
    assert "org.tizen." in text


def test_manifest_sha256_integrity():
    for line in (BACKUP_DIR / "manifest.sha256").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        expected, rel = line.strip().split(maxsplit=1)
        actual = hashlib.sha256((BACKUP_DIR / Path(rel).name).read_bytes()).hexdigest()
        assert actual == expected, f"SHA-256 mismatch for {rel}"


def test_baseline_screenshots_saved():
    d = BACKUP_DIR / "screenshots"
    shots = list(d.glob("01_baseline_*.jpg")) + list(d.glob("01_baseline_*.png"))
    if not shots:
        # Manual step: the TV can't be screenshotted over SDB; a phone photo of Smart Hub goes here.
        pytest.skip("No 01_baseline_*.jpg/png photo of the TV in backups/screenshots/ yet (manual step)")

