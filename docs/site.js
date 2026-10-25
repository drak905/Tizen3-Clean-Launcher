// Language switch: Vietnamese by default; ?lang=en or the EN button switches; the choice is remembered.
(function () {
  var root = document.documentElement;
  var TITLES = {
    vi: "Tizen 3.0 Clean Launcher — Màn hình chính gọn gàng cho TV Samsung đời cũ",
    en: "Tizen 3.0 Clean Launcher — A clean home screen for older Samsung TVs"
  };
  function setLang(lang, remember) {
    if (lang !== "vi" && lang !== "en") { lang = "vi"; }
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    document.title = TITLES[lang];
    var buttons = document.querySelectorAll("[data-set-lang]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(buttons[i].getAttribute("data-set-lang") === lang));
    }
    if (remember) { try { localStorage.setItem("lang", lang); } catch (e) {} }
  }
  var fromUrl = (location.search.match(/[?&]lang=(vi|en)\b/) || [])[1];
  var saved = null;
  try { saved = localStorage.getItem("lang"); } catch (e) {}
  setLang(fromUrl || saved || "vi", false);
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-set-lang]") : null;
    if (b) { setLang(b.getAttribute("data-set-lang"), true); }
  });
})();
