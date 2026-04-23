// District summary: sparklines + right-side "District report" panel
// Vanilla JS, no build step. Matches the HEARTS360 template.css look.
(function () {
  "use strict";

  // ---------- Sparklines ----------
  // Matches the logic in src/lib/sparkline.ts of the React tool so the visual
  // language is identical between the inline summary and the expanded report.
  function generateSeries(current, delta, len) {
    len = len || 6;
    var spread = Math.max(2, Math.abs(delta) * 3);
    var start = current - (delta >= 0 ? spread : -spread);
    var out = [];
    for (var i = 0; i < len; i++) {
      var t = i / (len - 1);
      var ease = t * t * (3 - 2 * t);
      var noise = Math.sin((i + current * 0.13) * 1.7) * 0.6;
      var v = start + (current - start) * ease + noise;
      if (i === len - 1) v = current;
      v = Math.max(0, Math.min(100, Math.round(v * 10) / 10));
      out.push(v);
    }
    return out;
  }

  function sparkPath(data, width, height, pad) {
    pad = pad == null ? 2 : pad;
    if (data.length < 2) return "";
    var min = Infinity, max = -Infinity;
    for (var i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    var range = (max - min) || 1;
    var step = (width - pad * 2) / (data.length - 1);
    var d = "";
    for (var j = 0; j < data.length; j++) {
      var x = pad + j * step;
      var y = pad + (1 - (data[j] - min) / range) * (height - pad * 2);
      d += (j === 0 ? "M" : " L") + x.toFixed(2) + "," + y.toFixed(2);
    }
    return d;
  }

  function dotTone(delta, goodDir) {
    if (delta === 0) return "flat";
    var positive = delta > 0;
    if (goodDir === "up") return positive ? "good" : "bad";
    return positive ? "bad" : "good";
  }

  function renderTrend(trendEl) {
    var current = parseFloat(trendEl.getAttribute("data-current"));
    var delta = parseFloat(trendEl.getAttribute("data-delta"));
    var goodDir = trendEl.getAttribute("data-good") || "up";

    // Delta text
    var deltaEl = trendEl.querySelector(".trend-delta");
    if (deltaEl) {
      var tone = dotTone(delta, goodDir);
      deltaEl.classList.remove("good", "bad");
      if (tone === "good") deltaEl.classList.add("good");
      else if (tone === "bad") deltaEl.classList.add("bad");

      if (delta === 0) {
        deltaEl.textContent = "No change";
      } else {
        var sign = delta > 0 ? "+" : "\u2212"; // minus sign
        deltaEl.textContent = sign + Math.abs(delta) + " pp";
      }
    }

    // Sparkline SVG
    var svg = trendEl.querySelector(".sparkline");
    if (!svg) return;
    var W = 100, H = 28;
    var series = generateSeries(current, delta, 6);
    var path = sparkPath(series, W, H, 2);
    var tone2 = dotTone(delta, goodDir);
    var lastX = 100 - 2; // end padding
    var min = Math.min.apply(null, series);
    var max = Math.max.apply(null, series);
    var range = (max - min) || 1;
    var lastY = 2 + (1 - (series[series.length - 1] - min) / range) * (H - 4);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML =
      '<path class="spark-line ' + tone2 + '" d="' + path + '" />' +
      '<circle class="spark-dot ' + tone2 + '" cx="' + lastX.toFixed(2) +
      '" cy="' + lastY.toFixed(2) + '" r="2" />';
  }

  function initSparklines() {
    var trends = document.querySelectorAll(".trends-grid .trend");
    for (var i = 0; i < trends.length; i++) renderTrend(trends[i]);
  }

  // ---------- District report panel ----------
  function initPanel() {
    var panel = document.getElementById("district-report-panel");
    var overlay = document.getElementById("district-report-overlay");
    var openBtn = document.getElementById("open-district-report");
    var closeBtn = document.getElementById("drp-close");
    var openNewBtn = document.getElementById("drp-open-new");
    var frame = document.getElementById("drp-frame");
    var resizer = panel && panel.querySelector(".drp-resizer");
    if (!panel || !openBtn || !frame) return;

    var TOOL_URL = "./tool/index.html";
    var loaded = false;
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      openBtn.setAttribute("aria-expanded", "true");
      if (!loaded) {
        frame.classList.add("loading");
        frame.src = TOOL_URL;
        frame.addEventListener(
          "load",
          function onLoad() {
            frame.classList.remove("loading");
            frame.removeEventListener("load", onLoad);
          },
          { once: true }
        );
        loaded = true;
      }
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      if (overlay) overlay.classList.add("open");
      document.body.classList.add("drp-open");
      // Focus the close button for keyboard users
      setTimeout(function () { closeBtn && closeBtn.focus(); }, 220);
    }

    function close() {
      openBtn.setAttribute("aria-expanded", "false");
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
      if (overlay) overlay.classList.remove("open");
      document.body.classList.remove("drp-open");
      if (lastFocus && typeof lastFocus.focus === "function") {
        try { lastFocus.focus(); } catch (_) { /* no-op */ }
      }
    }

    openBtn.setAttribute("aria-expanded", "false");
    openBtn.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (overlay) overlay.addEventListener("click", close);
    if (openNewBtn) {
      openNewBtn.addEventListener("click", function () {
        window.open(TOOL_URL, "_blank", "noopener");
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("open")) {
        close();
      }
    });

    // Deep-link: #district-report or ?report=1 auto-opens the panel on load
    try {
      var params = new URLSearchParams(window.location.search);
      if (
        window.location.hash === "#district-report" ||
        params.get("report") === "1"
      ) {
        open();
      }
    } catch (_) { /* no-op */ }

    // ---------- Resizer (desktop) ----------
    if (resizer) {
      var dragging = false;
      var startX = 0;
      var startWidth = 0;

      function onPointerDown(e) {
        dragging = true;
        resizer.classList.add("dragging");
        startX = e.clientX;
        startWidth = panel.getBoundingClientRect().width;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
        // Disable pointer events in the iframe while dragging so pointerup reaches us
        frame.style.pointerEvents = "none";
        if (resizer.setPointerCapture && e.pointerId != null) {
          try { resizer.setPointerCapture(e.pointerId); } catch (_) {}
        }
      }

      function onPointerMove(e) {
        if (!dragging) return;
        var dx = e.clientX - startX;
        // Panel grows when dragging left (since it anchors to the right)
        var next = startWidth - dx;
        var min = 320;
        var max = Math.min(window.innerWidth - 60, 900);
        if (next < min) next = min;
        if (next > max) next = max;
        panel.style.width = next + "px";
      }

      function onPointerUp() {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove("dragging");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        frame.style.pointerEvents = "";
      }

      resizer.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);

      // Double-click resizer to reset width
      resizer.addEventListener("dblclick", function () {
        panel.style.width = "";
      });
    }
  }

  function init() {
    initSparklines();
    initPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
