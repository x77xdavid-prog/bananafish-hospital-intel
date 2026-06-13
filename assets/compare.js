/* 병원인텔리전스/assets/compare.js — 후보지 비교 MVP
   data.js(window.HII_HOSPITALS)가 먼저 로드된 뒤 실행됨(둘 다 defer, 순서 보장).
   1) 동(읍·면·동) 유니크 인덱스를 한 번만 생성 → 자동완성
   2) 동 중심점(해당 동 기관 좌표 평균) 기준 반경 집계(박스 프리필터 + 하버사인)
   3) 후보지별 카드 렌더 — 동일 종별 최소 카드에 "상대적 여유" 배지 */
(function () {
  "use strict";

  var SUGGEST_MAX = 8;        // 자동완성 최대 제안 수
  var BOX_LAT = 0.02;         // 반경 프리필터(위도 ±, 약 2.2km)
  var BOX_LNG = 0.025;        // 반경 프리필터(경도 ±, 한국 위도 기준 약 2.2km)
  var EARTH_R = 6371000;      // 지구 반지름(m)
  var DAY_MS = 86400000;
  var YEAR_MS = 365 * DAY_MS;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function fmt(n) { return (n || 0).toLocaleString("ko-KR"); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var statusEl = $("#cmpStatus");
  function setStatus(msg, isErr) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-error", !!isErr);
  }

  // ---- 데이터 확인 ----
  var hospitals = window.HII_HOSPITALS;
  var meta = window.HII_META || {};
  if (!hospitals || !hospitals.length) {
    setStatus("데이터를 불러오지 못했습니다. 새로고침해 주세요.", true);
    return;
  }
  // 신규 개원 기준 시점 = 데이터 생성일(없으면 오늘)
  var baseTime = Date.parse(meta.generated || "") || Date.now();

  // ---- 동(emd) 유니크 인덱스 — 전체 배열을 한 번만 순회 ----
  // key: sido|gu|emd → { sido, gu, emd, count(동 전체 기관 수), lat/lng(좌표 평균), geo(좌표 보유 수) }
  var emdList = [];
  (function buildIndex() {
    var map = {}, i, h, key, e;
    for (i = 0; i < hospitals.length; i++) {
      h = hospitals[i];
      if (!h.emd) continue;
      key = h.sido + "|" + h.gu + "|" + h.emd;
      e = map[key];
      if (!e) {
        e = map[key] = { sido: h.sido, gu: h.gu, emd: h.emd, count: 0, latSum: 0, lngSum: 0, geo: 0 };
        emdList.push(e);
      }
      e.count++;
      if (h.lat && h.lng) { e.latSum += h.lat; e.lngSum += h.lng; e.geo++; }
    }
    for (i = 0; i < emdList.length; i++) {
      e = emdList[i];
      e.lat = e.geo ? e.latSum / e.geo : 0;
      e.lng = e.geo ? e.lngSum / e.geo : 0;
      e.normEmd = e.emd.replace(/\s+/g, "");                       // "역삼동"
      e.norm = (e.sido + e.gu + e.emd).replace(/\s+/g, "");        // "서울강남구역삼동"
      e.normSidoEmd = (e.sido + e.emd).replace(/\s+/g, "");        // "서울역삼동"
    }
    // 기관 수 많은 동부터 제안되도록 정렬
    emdList.sort(function (a, b) { return b.count - a.count; });
  })();

  // ---- 자동완성 검색: 동 이름 앞글자 일치 우선, 그 외 시도·구 포함 부분 일치 ----
  function searchEmd(q) {
    var query = q.replace(/\s+/g, "");
    if (!query) return [];
    var starts = [], contains = [], i, e;
    for (i = 0; i < emdList.length; i++) {
      e = emdList[i];
      if (e.normEmd.indexOf(query) === 0) {
        starts.push(e);
        if (starts.length >= SUGGEST_MAX) break;
      } else if (contains.length < SUGGEST_MAX &&
                 (e.norm.indexOf(query) !== -1 || e.normSidoEmd.indexOf(query) !== -1)) {
        contains.push(e);
      }
    }
    return starts.concat(contains).slice(0, SUGGEST_MAX);
  }

  // 입력값과 정확히 일치하는 동이 전국에 1곳뿐이면 자동 선택용으로 반환
  function resolveExact(v) {
    var q = v.replace(/\s+/g, "");
    if (!q) return null;
    var hit = null, n = 0, i, e;
    for (i = 0; i < emdList.length; i++) {
      e = emdList[i];
      if (e.normEmd === q || (e.gu + e.emd).replace(/\s+/g, "") === q || e.norm === q) {
        hit = e; n++;
        if (n > 1) return null; // 동명이동(同名異洞) — 목록에서 직접 선택 필요
      }
    }
    return n === 1 ? hit : null;
  }

  // ---- 거리/집계 ----
  function haversine(lat1, lng1, lat2, lng2) {
    var rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH_R * Math.asin(Math.sqrt(a));
  }
  function openTime(s) {
    if (!s) return 0;
    var t = Date.parse(s);
    return isNaN(t) ? 0 : t;
  }
  function matchKw(h, kw) {
    if (h.name && h.name.indexOf(kw) !== -1) return true;
    var d = h.depts;
    if (!d || !d.length) return false;
    // depts 항목은 ["진료과목명", n] 튜플 — 과목명 문자열에 부분 일치
    for (var i = 0; i < d.length; i++) {
      var nm = Array.isArray(d[i]) ? d[i][0] : d[i];
      if (typeof nm === "string" && nm.indexOf(kw) !== -1) return true;
    }
    return false;
  }

  // 동 중심점 기준 반경 집계 — lat/lng 박스 프리필터 후 하버사인 정밀 계산
  function aggregate(center, radiusM, cl, kw) {
    var res = { total: 0, sameCl: 0, kwMatch: 0, new1: 0, new3: 0, byCl: {}, top: [] };
    var cut1 = baseTime - YEAR_MS, cut3 = baseTime - 3 * YEAR_MS;
    var latMin = center.lat - BOX_LAT, latMax = center.lat + BOX_LAT;
    var lngMin = center.lng - BOX_LNG, lngMax = center.lng + BOX_LNG;
    var i, h, t;
    for (i = 0; i < hospitals.length; i++) {
      h = hospitals[i];
      if (!h.lat || !h.lng) continue;
      if (h.lat < latMin || h.lat > latMax || h.lng < lngMin || h.lng > lngMax) continue;
      if (haversine(center.lat, center.lng, h.lat, h.lng) > radiusM) continue;
      res.total++;
      res.byCl[h.cl] = (res.byCl[h.cl] || 0) + 1;
      if (h.cl === cl) {
        res.sameCl++;
        t = openTime(h.open);
        if (t) {
          if (t >= cut1) res.new1++;
          if (t >= cut3) res.new3++;
        }
      }
      if (kw && matchKw(h, kw)) res.kwMatch++;
    }
    var keys = Object.keys(res.byCl);
    keys.sort(function (a, b) { return res.byCl[b] - res.byCl[a]; });
    for (i = 0; i < keys.length && i < 3; i++) res.top.push({ cl: keys[i], n: res.byCl[keys[i]] });
    return res;
  }

  // ---- 슬롯(후보지 입력) ----
  var addBtn = $("#cmpAdd");
  var slots = Array.prototype.slice.call(document.querySelectorAll(".cmp-slot")).map(function (root) {
    return {
      root: root,
      input: $(".cmp-slot__input", root),
      ac: $(".cmp-ac", root),
      pickedEl: $(".cmp-slot__picked", root),
      errEl: $(".cmp-slot__err", root),
      picked: null, sugs: [], active: -1
    };
  });

  function visibleSlots() {
    return slots.filter(function (s) { return !s.root.hidden; });
  }
  function hideAc(slot) { slot.ac.hidden = true; slot.active = -1; }
  function clearPick(slot) {
    slot.picked = null;
    slot.pickedEl.hidden = true;
    slot.root.classList.remove("is-picked");
  }
  function clearSlot(slot) {
    slot.input.value = "";
    clearPick(slot);
    hideAc(slot);
    slot.errEl.hidden = true;
  }
  function slotErr(slot, msg) {
    slot.errEl.textContent = msg;
    slot.errEl.hidden = false;
  }
  function pick(slot, e) {
    slot.picked = e;
    slot.input.value = e.gu + " " + e.emd;
    hideAc(slot);
    slot.pickedEl.textContent = "✓ " + e.sido + " " + e.gu + " " + e.emd + " · 의료기관 " + fmt(e.count) + "곳";
    slot.pickedEl.hidden = false;
    slot.errEl.hidden = true;
    slot.root.classList.add("is-picked");
  }

  function renderAc(slot, items, query) {
    slot.sugs = items;
    slot.active = -1;
    var html = "", i, e;
    if (!items.length) {
      html = '<div class="cmp-ac__empty">‘' + escapeHtml(query) + '’ 검색 결과가 없습니다 — 동(읍·면·동) 이름을 확인해 주세요.</div>';
    } else {
      for (i = 0; i < items.length; i++) {
        e = items[i];
        html += '<button type="button" class="cmp-ac__item" role="option" data-i="' + i + '">' +
                  '<span class="cmp-ac__name">' + escapeHtml(e.gu + " " + e.emd) + '</span>' +
                  '<span class="cmp-ac__meta">' + escapeHtml(e.sido) + ' · ' + fmt(e.count) + '곳</span>' +
                '</button>';
      }
    }
    slot.ac.innerHTML = html;
    slot.ac.hidden = false;
  }

  function moveActive(slot, dir) {
    if (!slot.sugs.length) return;
    slot.active = (slot.active + dir + slot.sugs.length) % slot.sugs.length;
    var items = slot.ac.querySelectorAll(".cmp-ac__item");
    for (var i = 0; i < items.length; i++) items[i].classList.toggle("is-active", i === slot.active);
    if (items[slot.active] && items[slot.active].scrollIntoView) items[slot.active].scrollIntoView({ block: "nearest" });
  }

  slots.forEach(function (slot) {
    slot.input.addEventListener("input", function () {
      if (slot.picked) clearPick(slot);
      slot.errEl.hidden = true;
      var v = slot.input.value.trim();
      if (!v) { hideAc(slot); return; }
      renderAc(slot, searchEmd(v), v);
    });
    slot.input.addEventListener("focus", function () {
      var v = slot.input.value.trim();
      if (v && !slot.picked) renderAc(slot, searchEmd(v), v);
    });
    slot.input.addEventListener("keydown", function (ev) {
      if (slot.ac.hidden) return;
      if (ev.key === "ArrowDown") { ev.preventDefault(); moveActive(slot, 1); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); moveActive(slot, -1); }
      else if (ev.key === "Enter") {
        if (slot.active >= 0 && slot.sugs[slot.active]) { ev.preventDefault(); pick(slot, slot.sugs[slot.active]); }
        else if (slot.sugs.length === 1) { ev.preventDefault(); pick(slot, slot.sugs[0]); }
      }
      else if (ev.key === "Escape") hideAc(slot);
    });
    slot.ac.addEventListener("click", function (ev) {
      var btn = ev.target.closest ? ev.target.closest(".cmp-ac__item") : null;
      if (!btn) return;
      var e = slot.sugs[parseInt(btn.getAttribute("data-i"), 10)];
      if (e) pick(slot, e);
    });
    var del = $(".cmp-slot__del", slot.root);
    if (del) del.addEventListener("click", function () {
      clearSlot(slot);
      slot.root.hidden = true;
      addBtn.disabled = false;
    });
  });

  // 드롭다운 바깥 클릭 시 닫기
  document.addEventListener("pointerdown", function (ev) {
    slots.forEach(function (slot) {
      if (!slot.root.contains(ev.target)) hideAc(slot);
    });
  });

  // 후보지 추가(최대 3)
  addBtn.addEventListener("click", function () {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].root.hidden) {
        slots[i].root.hidden = false;
        addBtn.disabled = true; // 슬롯 3개가 전부 — 더 추가 불가
        slots[i].input.focus();
        return;
      }
    }
  });

  // ---- 공통 옵션 ----
  var clSel = $("#cmpCl");
  var kwInput = $("#cmpKw");
  var segBtns = Array.prototype.slice.call(document.querySelectorAll("#cmpRadius .cmp-seg__btn"));
  segBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      segBtns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    });
  });
  function currentRadius() {
    for (var i = 0; i < segBtns.length; i++) {
      if (segBtns[i].getAttribute("aria-pressed") === "true") return parseInt(segBtns[i].getAttribute("data-r"), 10);
    }
    return 500;
  }
  kwInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); runCompare(); }
  });

  // ---- 비교 실행 ----
  var runBtn = $("#cmpRun");
  var results = $("#cmpResults");
  var grid = $("#cmpGrid");
  var cond = $("#cmpCond");
  var hint = $("#cmpHint");
  var foot = $("#cmpFoot");

  function statRow(label, value, isKey) {
    return '<div class="' + (isKey ? "is-key" : "") + '"><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }

  function cardHtml(row, cl, kw, rLabel) {
    var e = row.e, agg = row.agg;
    var h = '<article class="cmp-card' + (row.best ? " is-best" : "") + '" data-tilt data-rise>';
    if (row.best) h += '<span class="cmp-card__badge">상대적 여유</span>';
    h += '<header class="cmp-card__head">' +
           '<p class="cmp-card__region">' + escapeHtml(e.sido + " " + e.gu) + '</p>' +
           '<h3 class="cmp-card__name">' + escapeHtml(e.emd) + '</h3>' +
           '<p class="cmp-card__total">동 전체 의료기관 <b>' + fmt(e.count) + '</b>곳</p>' +
         '</header>';
    if (!agg) {
      h += '<p class="cmp-card__nogeo">이 동은 좌표 정보가 부족해 반경 집계를 제공할 수 없습니다. 동 전체 수만 참고해 주세요.</p></article>';
      return h;
    }
    h += '<span class="cmp-card__radius">반경 ' + rLabel + ' 집계</span>';
    h += '<dl class="cmp-stats">';
    h += statRow("전체 의료기관", fmt(agg.total) + "곳");
    h += statRow("동일 종별 · " + escapeHtml(cl), fmt(agg.sameCl) + "곳", true);
    if (kw) h += statRow("‘" + escapeHtml(kw) + "’ 매칭 <small>(진료과목·기관명)</small>", fmt(agg.kwMatch) + "곳");
    h += statRow("신규 개원(" + escapeHtml(cl) + ") · 최근 1년", fmt(agg.new1) + "곳");
    h += statRow("신규 개원(" + escapeHtml(cl) + ") · 최근 3년", fmt(agg.new3) + "곳");
    h += '</dl>';
    if (agg.top.length) {
      h += '<div class="cmp-top"><span class="cmp-top__label">반경 내 종별 TOP 3</span><ul class="cmp-top__list">';
      for (var i = 0; i < agg.top.length; i++) {
        h += '<li>' + escapeHtml(agg.top[i].cl) + ' <b>' + fmt(agg.top[i].n) + '</b></li>';
      }
      h += '</ul></div>';
    }
    h += '</article>';
    return h;
  }

  function runCompare() {
    var vis = visibleSlots();
    var pickedList = [];
    var hasErr = false;
    vis.forEach(function (slot) {
      slot.errEl.hidden = true;
      var v = slot.input.value.trim();
      if (slot.picked) {
        pickedList.push(slot.picked);
      } else if (v) {
        var m = resolveExact(v); // 전국에 하나뿐인 동이면 자동 매칭
        if (m) { pick(slot, m); pickedList.push(m); }
        else { slotErr(slot, "자동완성 목록에서 동을 선택해 주세요."); hasErr = true; }
      }
    });
    if (hasErr) { setStatus("선택되지 않은 후보지가 있습니다 — 목록에서 동을 골라 주세요.", true); return; }
    if (!pickedList.length) { setStatus("후보지를 검색해 1곳 이상 선택해 주세요.", true); return; }
    setStatus("동 중심점 기준 단순 반경 집계 · 기준 데이터 " + (meta.version || "2026.3"));

    var radius = currentRadius();
    var cl = clSel.value;
    var kw = kwInput.value.trim();
    var rLabel = radius >= 1000 ? "1km" : radius + "m";

    var rows = pickedList.map(function (e) {
      return { e: e, agg: e.geo ? aggregate(e, radius, cl, kw) : null, best: false };
    });
    // 동일 종별 수가 가장 적은 카드에 배지(2곳 이상 비교 + 값 차이가 있을 때만)
    var withAgg = rows.filter(function (r) { return !!r.agg; });
    if (rows.length >= 2 && withAgg.length >= 2) {
      var vals = withAgg.map(function (r) { return r.agg.sameCl; });
      var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
      if (min < max) withAgg.forEach(function (r) { r.best = r.agg.sameCl === min; });
    }

    var html = "";
    rows.forEach(function (r) { html += cardHtml(r, cl, kw, rLabel); });
    grid.innerHTML = html;
    if (window.FX3D) window.FX3D.apply(grid);   // 결과 카드 3D 인터랙션
    cond.textContent = cl + " 기준 · 반경 " + rLabel + (kw ? " · 키워드 ‘" + kw + "’" : "");
    if (rows.length === 1) {
      hint.textContent = "후보지를 1곳 더 추가하면 ‘상대적 여유’까지 나란히 비교할 수 있어요.";
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
    results.hidden = false;
    foot.hidden = false;
    results.scrollIntoView({ block: "start" });
  }
  runBtn.addEventListener("click", runCompare);

  // ---- 초기화: 데이터 준비 완료 → 컨트롤 활성화 ----
  (function enableUI() {
    var controls = document.querySelectorAll(".cmp-form input, .cmp-form select, .cmp-form button");
    for (var i = 0; i < controls.length; i++) controls[i].disabled = false;
    // 슬롯 3이 숨겨져 있으면 추가 버튼 활성 유지(이미 위에서 활성화됨)
    setStatus("준비 완료 · 전국 의료기관 " + fmt(hospitals.length) + "곳 데이터");
  })();
})();
