/* 공유 인터랙티브 배경 (고정값·패널 없음)
   .fx-blob 요소를 마우스/시간에 따라 시차 이동 + 은은한 색 변화.
   페이지 body[data-fx-opacity]로 진하기만 조정. prefers-reduced-motion 시 정지. */
(function () {
  var blobs = Array.prototype.slice.call(document.querySelectorAll(".fx-blob"));
  if (!blobs.length) return;

  var op = parseFloat(document.body.getAttribute("data-fx-opacity"));
  if (isNaN(op)) op = 0.6;
  var BLUR = 120, SCALE = 1.15, SPEED = 3, HUE = 50;

  blobs.forEach(function (b) { b.style.opacity = op; });

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    blobs.forEach(function (b) { b.style.filter = "blur(" + BLUR + "px)"; b.style.transform = "scale(" + SCALE + ")"; });
    return;
  }

  var conf = blobs.map(function (_, i) {
    return { depth: (90 + i * 54) * 3, sx: 0.00020 + i * 0.00006, sy: 0.00026 + i * 0.00005,
             ax: 24 + i * 8, ay: 20 + i * 7, dir: (i % 2 ? -1 : 1), cx: 0, cy: 0 };
  });
  var tx = 0, ty = 0, hue = 0, hueT = 0;

  window.addEventListener("pointermove", function (e) {
    tx = (e.clientX / window.innerWidth) * 2 - 1;
    ty = (e.clientY / window.innerHeight) * 2 - 1;
    hueT = tx * HUE;
  }, { passive: true });

  function frame(t) {
    hue += (hueT - hue) * 0.035;
    for (var i = 0; i < blobs.length; i++) {
      var c = conf[i];
      var dx = Math.sin(t * c.sx * SPEED) * c.ax, dy = Math.cos(t * c.sy * SPEED) * c.ay;
      var mx = tx * c.depth * c.dir, my = ty * c.depth;
      c.cx += (mx - c.cx) * 0.045; c.cy += (my - c.cy) * 0.045;
      blobs[i].style.transform = "translate3d(" + (dx + c.cx).toFixed(1) + "px," + (dy + c.cy).toFixed(1) + "px,0) scale(" + SCALE + ")";
      blobs[i].style.filter = "blur(" + BLUR + "px) hue-rotate(" + hue.toFixed(1) + "deg)";
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
