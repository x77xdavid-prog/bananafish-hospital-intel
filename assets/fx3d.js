/* fx3d — 3D 인터랙티브 동작(틸트 + 진입 등장). 의존성 없음.
   window.FX3D.apply(root) 로 동적으로 추가된 콘텐츠에도 적용 가능. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var MAX = 7;   // 최대 틸트 각도(deg)

  function bindTilt(el) {
    if (el._fx3d) return;
    el._fx3d = true;
    var raf = null, rx = 0, ry = 0;
    function apply() {
      raf = null;
      el.style.transform = "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
    }
    el.addEventListener("pointermove", function (ev) {
      if (ev.pointerType === "touch") return;
      var r = el.getBoundingClientRect();
      ry = ((ev.clientX - r.left) / r.width - 0.5) * MAX * 2;
      rx = -((ev.clientY - r.top) / r.height - 0.5) * MAX * 2;
      el.classList.add("is-tilting");
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener("pointerleave", function () {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      el.classList.remove("is-tilting");
      el.style.transform = "";
    });
  }

  var io = (!reduce && "IntersectionObserver" in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" })
    : null;

  function apply(root) {
    root = root || document;
    var rises = root.querySelectorAll("[data-rise]:not(.is-in)");
    Array.prototype.forEach.call(rises, function (el, i) {
      if (io) { el.style.setProperty("--rise-delay", (i % 6) * 45 + "ms"); io.observe(el); }
      else el.classList.add("is-in");
    });
    if (!reduce && canHover) {
      Array.prototype.forEach.call(root.querySelectorAll("[data-tilt]"), bindTilt);
    }
  }

  apply(document);
  window.FX3D = { apply: apply };
})();
