/* Home screen for Samsung Tizen 3.0, styled after CleanFrame (https://github.com/nthnclrk/CleanFrame).
   ES5 only (the TV runs WebKit 538). Remote: Left/Right move, Up/Down switch between the dock and the
   top-right controls, OK opens, Return goes back to the dock (never leaves), Yellow = next wallpaper,
   Red = toggle the diagnostic log. */
(function () {
  "use strict";

  var CFG = window.DockConfig, WALLS = window.DockWallpapers || [], METRICS = window.DockIconMetrics || {};
  var DEFAULT_OP = "http://tizen.org/appcontrol/operation/default";
  var TILE_W = 288, PITCH = 296, SHELF_W = 1696, GLIMPSE = TILE_W / 2;   // SHELF_W is set by layoutDock()
  var DOCK_X = 96, DOCK_Y = 676;
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 10009, RED: 403, YELLOW: 405, W: 87, D: 68 };

  function $(id) { return document.getElementById(id); }
  var stage = $("stage"), clockEl = $("clock"), utilsEl = $("utils"), lens = $("lens"), lensImg = $("lensImg");
  var shelf = $("shelf"), track = $("track"), plate = $("plate"), matImg = $("matImg");
  var photos = [$("photoA"), $("photoB")], toastEl = $("toast"), debugEl = $("debug");

  var S = { zone: "apps", app: 0, util: 0, off: 0, wall: 0, photoLayer: 0, debug: false };
  var tiles = [], utilEls = [];

  /* ---------- storage + diagnostics ---------- */
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function diag(entry) {
    var log = load("diag", []);
    log.push(new Date().toTimeString().slice(0, 8) + " " + entry);
    log = log.slice(-200);
    save("diag", log);
    if (S.debug) { debugEl.textContent = log.slice(-12).join("\n"); }
  }
  var toastTimer = null;
  function toast(text, isError) {
    toastEl.textContent = text;
    toastEl.className = "toast is-on" + (isError ? " is-error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = "toast"; }, isError ? 7000 : 2200);
  }

  /* ---------- clock: 24-hour HH:MM ---------- */
  function renderClock() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    clockEl.textContent = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  /* ---------- wallpaper + pre-rendered glass ---------- */
  function applyWall(index, instant) {
    if (!WALLS.length) { return; }
    S.wall = (index + WALLS.length) % WALLS.length;
    var w = WALLS[S.wall], next = photos[1 - S.photoLayer], prev = photos[S.photoLayer];
    next.style.backgroundImage = "url('assets/wallpapers/" + w.id + ".jpg')";
    matImg.style.backgroundImage = "url('assets/materials/" + w.id + "-study-soft.jpg')";
    lensImg.style.backgroundImage = "url('assets/materials/" + w.id + "-field-blur.jpg')";
    stage.className = "stage tone-" + (w.tone === "light" ? "light" : "dark");
    if (instant) { next.style.webkitTransition = next.style.transition = "none"; }
    next.className = "photo is-on";
    prev.className = "photo";
    if (instant) { next.offsetWidth; next.style.webkitTransition = next.style.transition = ""; }
    S.photoLayer = 1 - S.photoLayer;
    save("wall", w.id);
  }
  function wallIndexById(id) { for (var i = 0; i < WALLS.length; i++) { if (WALLS[i].id === id) { return i; } } return 0; }

  /* ---------- icons, balanced by their visible ink (CleanFrame markHtml) ---------- */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function markHtml(a) {
    var W = 120, H = 72, SIZE = 58;
    if (!a.icon) {
      var words = a.name.split(/\s+/), letters = words[0].charAt(0) + (words.length > 1 ? words[1].charAt(0) : "");
      return '<span class="mark monogram">' + letters.toUpperCase() + "</span>";
    }
    var key = a.icon.replace(/^.*\//, "").replace(/\.svg$/, ""), m = a.metric || METRICS[key];
    var st = "width:" + W + "px;height:" + H + "px;left:0;top:0";
    if (m) {
      var weight = clamp(Math.pow(0.45 / m.fill, 0.3), 0.84, 1.25);
      var k = Math.min(W / m.w, H / m.h, SIZE * weight / Math.sqrt(m.w * m.h)), s = m.n * k;
      st = "width:" + s.toFixed(2) + "px;height:" + s.toFixed(2) + "px;left:" + (W / 2 - (m.x + m.w / 2) * k).toFixed(2) +
        "px;top:" + (H / 2 - (m.y + m.h / 2) * k).toFixed(2) + "px";
    }
    return '<span class="mark"><img alt="" src="assets/' + a.icon + '" style="' + st + '"></span>';
  }

  /* ---------- build ---------- */
  /* CleanFrame dock geometry: up to five apps -> a centred dock exactly as wide as its tiles;
     more than five -> the full-width "broad" dock that scrolls. */
  function layoutDock() {
    var n = CFG.apps.length, broad = n > 5, w;
    SHELF_W = broad ? 1696 : Math.max(1, n) * PITCH - 8;
    w = SHELF_W + 32;
    DOCK_X = Math.round((1920 - w) / 2);
    var dock = $("dock"), scrim = dock.querySelector(".mat-scrim");
    dock.style.left = DOCK_X + "px"; dock.style.width = w + "px";
    shelf.style.width = SHELF_W + "px";
    matImg.style.left = (-DOCK_X) + "px"; matImg.style.top = (-DOCK_Y) + "px";
    scrim.style.left = (-DOCK_X) + "px";
  }

  function build() {
    layoutDock();
    var html = "";
    CFG.utils.forEach(function (u, i) {
      html += '<div class="u" data-i="' + i + '"><img class="u-ico" alt="" src="assets/icons/' + u.icon + '.svg"><span class="u-label">' + u.name + "</span></div>";
    });
    utilsEl.innerHTML = html;
    utilEls = Array.prototype.slice.call(utilsEl.querySelectorAll(".u"));

    CFG.apps.forEach(function (a, i) {
      var el = document.createElement("div");
      el.className = "tile";
      el.setAttribute("data-i", String(i));
      el.innerHTML = markHtml(a) + '<span class="label">' + a.name + "</span>";
      el.style.webkitTransform = el.style.transform = "translate3d(" + (i * PITCH) + "px,0,0)";
      track.appendChild(el);
      tiles.push(el);
    });
    // Very long names drop to 32px, as in CleanFrame.
    tiles.forEach(function (el) { var l = el.querySelector(".label"); if (l.scrollWidth > 280) { l.style.fontSize = "32px"; } });

    tiles.forEach(function (el, i) { el.addEventListener("click", function () { S.zone = "apps"; S.app = i; render(); activate(); }); });
    utilEls.forEach(function (el, i) { el.addEventListener("click", function () { S.zone = "util"; S.util = i; render(); activate(); }); });
  }

  /* ---------- render ---------- */
  function dockOffset() {
    // CleanFrame "broad" dock: keep half a tile of the neighbour visible while scrolling.
    var n = CFG.apps.length, i = S.app, left = i * PITCH, off = S.off;
    if (left - off < (i > 0 ? GLIMPSE : 0)) { off = left - (i > 0 ? GLIMPSE : 0); }
    if (left + TILE_W - off > SHELF_W - (i < n - 1 ? GLIMPSE : 0)) { off = left + TILE_W - SHELF_W + (i < n - 1 ? GLIMPSE : 0); }
    return clamp(off, 0, Math.max(0, n * PITCH - 8 - SHELF_W));
  }
  function render() {
    var n = CFG.apps.length, inApps = S.zone === "apps";
    S.off = dockOffset();
    track.style.webkitTransform = track.style.transform = "translate3d(" + (-S.off) + "px,0,0)";
    plate.style.webkitTransform = plate.style.transform = "translate3d(" + (S.app * PITCH) + "px,0,0)";
    plate.className = "plate " + (inApps ? "on-focus" : "on-sel");
    tiles.forEach(function (el, i) {
      var left = i * PITCH - S.off, outside = left + TILE_W <= 0 || left >= SHELF_W;
      el.className = "tile" + (i === S.app ? (inApps ? " is-focus" : " is-sel") : "") + (outside ? " is-outside" : "");
    });
    shelf.className = "shelf" + (S.off > 0 ? " fade-l" : "") + (S.off + SHELF_W < n * PITCH - 8 ? " fade-r" : "");

    utilsEl.className = "utils" + (S.zone === "util" ? " is-awake" : "");
    utilEls.forEach(function (el, i) { el.className = "u" + (S.zone === "util" && i === S.util ? " is-focus" : ""); });
    var f = S.zone === "util" ? utilEls[S.util] : null;
    if (f) {
      var r = f.getBoundingClientRect(), x = Math.round(r.left), y = Math.round(r.top + (r.height - 60) / 2), w = Math.round(r.width);
      lens.style.left = x + "px"; lens.style.top = y + "px"; lens.style.width = w + "px";
      lensImg.style.left = (-x) + "px"; lensImg.style.top = (-y) + "px";
      lens.className = "lens is-on";
    } else {
      lens.className = "lens";
    }
  }

  /* ---------- opening apps ----------
     Tizen 3.0: launch() says OK but does not raise an app already running in the background, so use
     an operation/default app control first and launch() as a fallback. If the launcher is still on
     screen afterwards, retry once and then say so. */
  var pending = null, lastOpen = 0;
  function openApp(id, title, watch) {
    var tz = window.tizen;
    if (!(tz && tz.application)) { toast("Open this on the TV to launch " + title, true); diag("no tizen api"); return; }
    var now = Date.now();
    if (now - lastOpen < 2500) { diag("ignored repeat OK"); return; }   // remotes often repeat OK
    lastOpen = now;
    toast("Opening " + title + "\u2026");
    diag("launch " + id);
    function fail(err) {
      var msg = (err && (err.name + ": " + err.message)) || String(err);
      diag("launch FAIL " + id + " " + msg);
      toast("Couldn't open " + title + " (" + msg + ")", true);
    }
    function viaLaunch(firstErr) {
      try { tz.application.launch(id, function () { diag("launch OK " + id); }, function (e) { fail(e || firstErr); }); } catch (e) { fail(e); }
    }
    try {
      tz.application.launchAppControl(new tz.ApplicationControl(DEFAULT_OP, null, null, null, null), id,
        function () { diag("appcontrol OK " + id); }, viaLaunch, null);
    } catch (e) { viaLaunch(e); }
    clearTimeout(pending);
    if (watch === false) { return; }
    pending = setTimeout(function () {
      if (document.hidden) { return; }
      diag("still visible, retry launch() " + id);
      viaLaunch(null);
      pending = setTimeout(function () { if (!document.hidden) { fail({ name: "NotOpened", message: "the app did not come to the front" }); } }, 4000);
    }, 4000);
  }

  /* ---------- come back after an app closes ----------
     Some apps (Apple TV, FPT Play) terminate on Exit and the TV then shows its own screen instead of
     the app underneath. While an app opened from the dock is running, poll the running-app list
     (config.xml background-support="enable" keeps this timer alive). When that app has gone and the
     launcher is still hidden, bring the launcher back. Stop watching if the launcher comes back by
     itself, or if the user opens a different app elsewhere (a new app appears in the list). */
  var SELF_ID = null, watchTimer = null, watched = null;
  function selfId() {
    if (SELF_ID) { return SELF_ID; }
    try { SELF_ID = window.tizen.application.getCurrentApplication().appInfo.id; } catch (e) { SELF_ID = "AppleTVDoc.AppleTVDock"; }
    return SELF_ID;
  }
  // A store app (10-character package id) or a built-in player the user can open, from another package.
  // Helper services of the same app (e.g. rJeHak5zRg.SpotifyService) and system popups don't count.
  function isOtherUserApp(id, watchedId) {
    if (id === selfId() || id.split(".")[0] === watchedId.split(".")[0] || /service|daemon|widget|helper/i.test(id)) { return false; }
    return /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/.test(id) || id === "org.tizen.netflix-app" || id === "org.tizen.browser";
  }
  function runningIds(done) {
    try {
      window.tizen.application.getAppsContext(function (list) {
        var ids = {};
        list.forEach(function (c) { ids[c.appId] = true; });
        done(ids);
      }, function () { done(null); });
    } catch (e) { done(null); }
  }
  function stopWatch(reason) {
    if (!watched) { return; }
    diag("watch stop " + watched.id + " (" + reason + ")");
    watched = null;
    clearInterval(watchTimer);
  }
  function bringBack() {
    var tz = window.tizen, id = selfId();
    diag("bring launcher back");
    try {
      tz.application.launchAppControl(new tz.ApplicationControl(DEFAULT_OP, null, null, null, null), id,
        function () {}, function () { try { tz.application.launch(id); } catch (e) {} }, null);
    } catch (e) { try { tz.application.launch(id); } catch (e2) {} }
  }
  function watchApp(id) {
    if (!(window.tizen && window.tizen.application && window.tizen.application.getAppsContext)) { return; }
    stopWatch("new launch");
    runningIds(function (before) {
      watched = { id: id, seen: false, wasHidden: false, before: before || {}, started: Date.now() };
      diag("watch " + id);
      clearInterval(watchTimer);
      watchTimer = setInterval(function () {
        if (!watched) { return; }
        if (document.hidden) { watched.wasHidden = true; }
        // Home came back by itself after the app was in front: nothing to do.
        if (!document.hidden && watched.wasHidden) { stopWatch("launcher visible"); return; }
        runningIds(function (now) {
          if (!watched || !now) { return; }
          if (now[watched.id]) { watched.seen = true; }
          for (var k in now) {
            if (now.hasOwnProperty(k) && !watched.before[k] && isOtherUserApp(k, watched.id) && watched.seen) {
              stopWatch("other app " + k); return;
            }
          }
          if (watched.seen && !now[watched.id]) {
            var gone = watched.id;
            stopWatch("closed");
            if (document.hidden) { diag(gone + " closed while launcher hidden"); bringBack(); }
          } else if (!watched.seen && Date.now() - watched.started > 30000) {
            stopWatch("never started");
          }
        });
      }, 1500);
    });
  }

  function activate() {
    if (S.zone === "apps") {
      var a = CFG.apps[S.app];
      openApp(a.id, a.name, true);
      watchApp(a.id);
      return;
    }
    var u = CFG.utils[S.util];
    if (u.action === "wallpaper") {
      applyWall(S.wall + 1);
      toast(WALLS[S.wall].name + (WALLS[S.wall].credit ? " \u00b7 " + WALLS[S.wall].credit : ""));
      diag("wallpaper " + WALLS[S.wall].id);
    } else if (u.action === "app") {
      openApp(u.id, u.name, u.watch);
    }
  }

  /* ---------- remote ---------- */
  function onKey(e) {
    var code = e.keyCode || e.which, n = CFG.apps.length, handled = true;
    diag("key " + code);
    switch (code) {
      case KEY.LEFT:
        if (S.zone === "apps") { S.app = Math.max(0, S.app - 1); } else { S.util = Math.max(0, S.util - 1); }
        break;
      case KEY.RIGHT:
        if (S.zone === "apps") { S.app = Math.min(n - 1, S.app + 1); } else { S.util = Math.min(CFG.utils.length - 1, S.util + 1); }
        break;
      case KEY.UP:
        if (S.zone === "apps") { S.zone = "util"; }
        break;
      case KEY.DOWN:
        if (S.zone === "util") { S.zone = "apps"; }
        break;
      case KEY.OK:
        activate();
        break;
      case KEY.BACK:          // Return never leaves Home; from the controls it goes back to the dock.
        S.zone = "apps";
        break;
      case KEY.YELLOW: case KEY.W:
        applyWall(S.wall + 1);
        break;
      case KEY.RED: case KEY.D:
        S.debug = !S.debug;
        debugEl.className = "debug" + (S.debug ? " is-on" : "");
        diag("debug " + (S.debug ? "on" : "off"));
        break;
      default:
        handled = false;
    }
    if (handled) { e.preventDefault(); render(); save("focus", { zone: S.zone, app: S.app, util: S.util }); }
  }

  /* ---------- start ---------- */
  if (window.tizen && window.tizen.tvinputdevice) {
    try { window.tizen.tvinputdevice.registerKeyBatch(["ColorF0Red", "ColorF2Yellow"]); } catch (e) {}
  }
  document.addEventListener("keydown", onKey);
  document.addEventListener("tizenhwkey", function (e) { diag("hwkey " + e.keyName); if (e.preventDefault) { e.preventDefault(); } });
  document.addEventListener("visibilitychange", function () {
    diag("visibility " + (document.hidden ? "hidden" : "visible"));
    if (document.hidden) { clearTimeout(pending); } else { renderClock(); }
  });

  build();
  var f = load("focus", null);
  if (f) { S.zone = "apps"; S.app = clamp(f.app || 0, 0, CFG.apps.length - 1); S.util = clamp(f.util || 0, 0, CFG.utils.length - 1); }
  applyWall(wallIndexById(load("wall", WALLS.length ? WALLS[0].id : "")), true);
  renderClock();
  render();
  setInterval(renderClock, 10000);
  if (CFG.photoIntervalMs > 0) { setInterval(function () { if (!document.hidden) { applyWall(S.wall + 1); } }, CFG.photoIntervalMs); }
  diag("start");
  window.DockHome = { state: S, render: render };   // for tests
})();



