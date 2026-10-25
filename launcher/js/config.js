/* Dock apps and top-right controls for this TV (Samsung UA43M5503, Tizen 3.0).
   IDs come from `sdb shell 0 vd_applist`. `icon`: a file in assets/ (white artwork), or null for a
   monogram tile. `metric`: visible-ink box of the icon on a 240 grid, used to balance icon sizes. */
window.DockConfig = {
  apps: [
    { name: "YouTube",  id: "9Ur5IzDKqV.TizenYouTube", icon: "icons/youtube.svg" },
    { name: "Netflix",  id: "org.tizen.netflix-app",   icon: "icons/netflix.svg" },
    { name: "Apple TV", id: "Y6A54cEa22.AppleTV",       icon: "icons/appletv.svg" },
    { name: "FPT Play", id: "ZTpEFWgfa9.FPTPlay",       icon: null },
    { name: "Spotify",  id: "rJeHak5zRg.Spotify",       icon: "icons/spotify.svg" }
  ],
  // `watch: false` = Samsung opens these as overlays on top of the launcher, so the
  // "did it come to the front?" check must not run for them.
  utils: [
    { name: "Wallpaper", icon: "art",      action: "wallpaper" },
    { name: "All apps",  icon: "apps",     action: "app", id: "org.volt.apps", watch: true },
    { name: "Settings",  icon: "settings", action: "app", id: "org.tizen.menu", watch: false }
  ],
  photoIntervalMs: 0   // 0 = keep the chosen wallpaper; e.g. 600000 rotates every 10 minutes
};

