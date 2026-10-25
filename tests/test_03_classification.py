import pytest
import json
from pathlib import Path

FORBIDDEN_PREFIXES = ("org.tizen.", "com.samsung.", "adplatform.")


def _policy():
    p = Path("config/user_policy.json")
    assert p.exists(), "config/user_policy.json missing."
    return json.loads(p.read_text(encoding="utf-8"))


def test_user_policy_exists_and_is_approved():
    policy = _policy()
    assert policy.get("user_approved") is True
    assert policy.get("never_uninstall") is True
    assert len(policy.get("dock_favorites", [])) >= 1


def test_zero_packages_queued_for_uninstall():
    assert _policy().get("uninstall_pkgids", []) == []


@pytest.mark.skipif(not Path("backups/applist_baseline.txt").exists(), reason="no local baseline applist")
def test_dock_favorites_exist_on_tv():
    applist = Path("backups/applist_baseline.txt").read_text(encoding="utf-8-sig")
    for app in _policy()["dock_favorites"]:
        assert f"'{app['app_id']}'" in applist, f"Dock app {app} not installed on the TV"
