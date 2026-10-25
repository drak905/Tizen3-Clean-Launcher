#!/usr/bin/env python3
"""Parses `sdb shell 0 applist`, builds config/user_policy.json (never uninstall anything).

Usage: python scripts/03_classify_apps.py [--defaults]
  --defaults  non-interactive: pin every candidate app that is installed on the TV.
"""
import json
import re
import sys
from pathlib import Path

APPLIST_PATH = Path("backups/applist_baseline.txt")
POLICY_PATH = Path("config/user_policy.json")

# App IDs verified against this TV's applist_baseline.txt (the plan's generic IDs differ).
CANDIDATES = [
    {"title": "YouTube", "app_id": "9Ur5IzDKqV.TizenYouTube", "badge": "▶", "theme": "youtube-bg"},
    {"title": "Netflix", "app_id": "org.tizen.netflix-app", "badge": "N", "theme": "netflix-bg"},
    {"title": "FPT Play", "app_id": "ZTpEFWgfa9.FPTPlay", "badge": "FPT", "theme": "fpt-bg"},
    {"title": "Spotify", "app_id": "rJeHak5zRg.Spotify", "badge": "♫", "theme": "spotify-bg"},
    {"title": "Web Browser", "app_id": "org.tizen.browser", "badge": "🌐", "theme": "browser-bg"},
    {"title": "Live TV / HDMI", "app_id": "org.tizen.tv-viewer", "badge": "TV", "theme": "tv-bg"},
]


def parse_applist(text: str) -> list[dict]:
    apps = []
    for line in text.splitlines():
        m = re.match(r"^\s*'([^']*)'\s+'([^']*)'\s*$", line)
        if m:
            apps.append({"name": m.group(1).strip(), "app_id": m.group(2)})
    return apps


def yn(prompt: str, auto: bool) -> bool:
    if auto:
        return True
    return input(prompt + " [Y/n]: ").strip().lower() in ("", "y", "yes")


def main():
    auto = "--defaults" in sys.argv
    Path("config").mkdir(exist_ok=True)
    installed = parse_applist(APPLIST_PATH.read_text(encoding="utf-8-sig"))
    ids = {a["app_id"] for a in installed}
    print(f"Loaded {len(installed)} installed packages from {APPLIST_PATH}.")

    favorites = []
    for c in CANDIDATES:
        if c["app_id"] not in ids:
            print(f"  skip {c['title']} ({c['app_id']}): not installed")
            continue
        if yn(f"Pin '{c['title']}' ({c['app_id']}) to your dock?", auto):
            favorites.append(c)

    policy = {
        "model": "UA43M5503AKXXV",
        "os": "Tizen 3.0",
        "never_uninstall": True,
        "uninstall_pkgids": [],
        "features_kept": {
            "smart_view_mirroring": yn("Keep Smart View / mirroring?", auto),
            "live_dvb_t2_tv": yn("Keep live broadcast TV?", auto),
            "netflix_lowmem_helper": True,
        },
        "dock_favorites": favorites,
        "user_approved": True,
        "approval_mode": "defaults (auto)" if auto else "interactive",
    }
    POLICY_PATH.write_text(json.dumps(policy, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {POLICY_PATH}: {len(favorites)} dock apps, 0 packages queued for removal.")


if __name__ == "__main__":
    main()

