/* 병원인텔리전스/assets/myreport.js — V7 프로토타입: 즉석 개인화 사전진단 리포트
   '리포트 예시'를 보여주는 대신, 후보지(동)+과목+조건으로 '내 리포트'를 그 자리에서 생성.
   입지·경쟁 = data.js 반경 집계(compare와 동일 방식) · 인허가 = DiagLogic+CHECKLIST 재사용.
   전부 클라이언트 계산 — 입력이 서버로 가지 않는다. */
(function () {
  "use strict";

  var SUGGEST_MAX = 8;
  var BOX_LAT = 0.02, BOX_LNG = 0.025;   // 반경 프리필터(±약 2.2km)
  var EARTH_R = 6371000;
  var YEAR_MS = 365 * 86400000;
  var RADIUS_M = 500, RADIUS_WIDE_M = 1000;
  // 입지 간이등급(동일 종별 · 반경 500m 기준) — 단순 집계 기준임을 리포트에 명시
  var DENSITY_BANDS = [
    { max: 9,        label: "여유",  cls: "ok",   desc: "동일 종별 경쟁이 적은 편입니다." },
    { max: 29,       label: "보통",  cls: "mid",  desc: "평균적인 경쟁 환경입니다." },
    { max: 59,       label: "밀집",  cls: "warn", desc: "경쟁이 많아 차별화 전략이 필요합니다." },
    { max: Infinity, label: "과밀",  cls: "warn", desc: "최고 수준의 경쟁 밀집 지역입니다." }
  ];

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return (n || 0).toLocaleString("ko-KR"); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- 데이터 준비 ----
  var hospitals = window.HII_HOSPITALS;
  var meta = window.HII_META || {};
  if (!hospitals || !hospitals.length || !window.DiagLogic || !window.CHECKLIST) {
    $("mrStatus").textContent = "데이터를 불러오지 못했습니다. 새로고침해 주세요.";
    $("mrStatus").classList.add("is-error");
    return;
  }
  var baseTime = Date.parse(meta.generated || "") || Date.now();

  // ---- 동(emd) 인덱스 (compare.js와 동일 방식) ----
  var emdList = [];
  (function buildIndex() {
    var map = {}, i, h, key, e;
    for (i = 0; i < hospitals.length; i++) {
      h = hospitals[i];
      if (!h.emd) continue;
      key = h.sido + "|" + h.gu + "|" + h.emd;
      e = map[key];
      if (!e) { e = map[key] = { sido: h.sido, gu: h.gu, emd: h.emd, count: 0, latSum: 0, lngSum: 0, geo: 0 }; emdList.push(e); }
      e.count++;
      if (h.lat && h.lng) { e.latSum += h.lat; e.lngSum += h.lng; e.geo++; }
    }
    for (i = 0; i < emdList.length; i++) {
      e = emdList[i];
      e.lat = e.geo ? e.latSum / e.geo : 0;
      e.lng = e.geo ? e.lngSum / e.geo : 0;
      e.normEmd = e.emd.replace(/\s+/g, "");
      e.norm = (e.sido + e.gu + e.emd).replace(/\s+/g, "");
    }
    emdList.sort(function (a, b) { return b.count - a.count; });
  })();

  function searchEmd(q) {
    var query = q.replace(/\s+/g, "");
    if (!query) return [];
    var starts = [], contains = [], i, e;
    for (i = 0; i < emdList.length; i++) {
      e = emdList[i];
      if (e.normEmd.indexOf(query) === 0) {
        starts.push(e);
        if (starts.length >= SUGGEST_MAX) break;
      } else if (contains.length < SUGGEST_MAX && e.norm.indexOf(query) !== -1) {
        contains.push(e);
      }
    }
    return starts.concat(contains).slice(0, SUGGEST_MAX);
  }

  // ---- 반경 집계 ----
  function haversine(lat1, lng1, lat2, lng2) {
    var rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH_R * Math.asin(Math.sqrt(a));
  }
  function matchKw(h, kw) {
    if (h.name && h.name.indexOf(kw) !== -1) return true;
    var d = h.depts;
    if (!d || !d.length) return false;
    for (var i = 0; i < d.length; i++) {
      var nm = Array.isArray(d[i]) ? d[i][0] : d[i];
      if (typeof nm === "string" && nm.indexOf(kw) !== -1) return true;
    }
    return false;
  }
  function aggregate(center, radiusM, cl, kw) {
    var res = { total: 0, sameCl: 0, kwMatch: 0, new1: 0, new3: 0, byCl: {} };
    var cut1 = baseTime - YEAR_MS, cut3 = baseTime - 3 * YEAR_MS;
    var i, h, t;
    for (i = 0; i < hospitals.length; i++) {
      h = hospitals[i];
      if (!h.lat || !h.lng) continue;
      if (h.lat < center.lat - BOX_LAT || h.lat > center.lat + BOX_LAT ||
          h.lng < center.lng - BOX_LNG || h.lng > center.lng + BOX_LNG) continue;
      if (haversine(center.lat, center.lng, h.lat, h.lng) > radiusM) continue;
      res.total++;
      res.byCl[h.cl] = (res.byCl[h.cl] || 0) + 1;
      if (h.cl === cl) {
        res.sameCl++;
        t = Date.parse(h.open || "");
        if (t) { if (t >= cut1) res.new1++; if (t >= cut3) res.new3++; }
      }
      if (kw && matchKw(h, kw)) res.kwMatch++;
    }
    return res;
  }
  function densityBand(sameCl) {
    for (var i = 0; i < DENSITY_BANDS.length; i++) if (sameCl <= DENSITY_BANDS[i].max) return DENSITY_BANDS[i];
    return DENSITY_BANDS[DENSITY_BANDS.length - 1];
  }

  // ---- 입력 상태 ----
  var picked = null;                                  // 선택된 동
  var answers = {                                     // DiagLogic 호환 응답(간이)
    situation: "new", type: "clinic", depts: [], inpatient: 0,
    surgery: "none", radiology: "none", narcotics: false, regen: false,
    building: "new", floors: 1
  };
  var CL_TO_TYPE = { "의원": "clinic", "치과의원": "dental", "한의원": "oriental" };
  var selectedCl = "의원";

  // ---- 자동완성 바인딩 ----
  var emdInput = $("mrEmd"), sugBox = $("mrSuggest"), pickedEl = $("mrPicked"), errEl = $("mrErr");
  function renderSuggest(list) {
    if (!list.length) { sugBox.hidden = true; return; }
    sugBox.innerHTML = list.map(function (e, i) {
      return '<button type="button" class="mr-sug" data-i="' + i + '">'
        + '<b>' + esc(e.gu + " " + e.emd) + '</b><span>' + esc(e.sido) + ' · ' + fmt(e.count) + '곳</span></button>';
    }).join("");
    sugBox.hidden = false;
    sugBox._list = list;
  }
  function pickEmd(e) {
    picked = e;
    emdInput.value = e.gu + " " + e.emd;
    pickedEl.textContent = "✓ " + e.sido + " " + e.gu + " " + e.emd + " — 동 전체 의료기관 " + fmt(e.count) + "곳";
    pickedEl.hidden = false; errEl.hidden = true; sugBox.hidden = true;
    updateGo();
  }
  emdInput.addEventListener("input", function () {
    picked = null; pickedEl.hidden = true; updateGo();
    renderSuggest(searchEmd(emdInput.value));
  });
  sugBox.addEventListener("click", function (ev) {
    var b = ev.target.closest(".mr-sug"); if (!b) return;
    pickEmd(sugBox._list[parseInt(b.dataset.i, 10)]);
  });
  document.addEventListener("click", function (ev) {
    if (!ev.target.closest(".mr-emdwrap")) sugBox.hidden = true;
  });

  // ---- 칩(단일 선택) 바인딩 ----
  function bindChips(rootSel, onPick) {
    document.querySelectorAll(rootSel).forEach(function (group) {
      group.addEventListener("click", function (ev) {
        var b = ev.target.closest(".mr-chip"); if (!b) return;
        group.querySelectorAll(".mr-chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        onPick(group, b.dataset.val);
      });
    });
  }
  bindChips("#mrType", function (_g, val) {
    selectedCl = val;
    answers.type = CL_TO_TYPE[val] || "clinic";
  });
  bindChips(".mr-q .mr-chips", function (group, val) {
    var q = group.dataset.q;
    if (q === "floors" || q === "inpatient") answers[q] = parseInt(val, 10);
    else answers[q] = val;
  });

  function updateGo() { $("mrGo").disabled = !picked; }

  // ---- 리포트 생성 ----
  $("mrGo").addEventListener("click", function () {
    if (!picked) return;
    var kw = $("mrKw").value.trim();
    var near = aggregate(picked, RADIUS_M, selectedCl, kw);
    var wide = aggregate(picked, RADIUS_WIDE_M, selectedCl, kw);
    var dens = densityBand(near.sameCl);
    var score = window.DiagLogic.scoreCase(answers);
    var band = window.DiagLogic.difficultyBand(score);
    var applied = window.DiagLogic.matchCheckpoints(answers, window.CHECKLIST);
    var top = window.DiagLogic.topConcerns(applied, 3);
    renderReport({ kw: kw, near: near, wide: wide, dens: dens, score: score, band: band, applied: applied, top: top });
  });

  function bar(label, n, maxN, hot) {
    var w = maxN ? Math.max(3, Math.round(n / maxN * 100)) : 0;
    return '<div class="rs-bar">'
      + '<span class="rs-bar__label">' + esc(label) + '</span>'
      + '<span class="rs-bar__track"><span class="rs-bar__fill' + (hot ? " rs-bar--hot" : "") + '" style="width:' + w + '%"></span></span>'
      + '<span class="rs-bar__val">' + fmt(n) + '</span></div>';
  }

  function renderReport(r) {
    var today = (meta.generated || "").slice(0, 10) || "최신";
    var kwLabel = r.kw ? "‘" + esc(r.kw) + "’ " : "";
    var clKw = selectedCl + (r.kw ? " · " + esc(r.kw) : "");
    // 칩 톤: 여유=기본, 보통=mid, 밀집/과밀=warn
    var densCls = r.dens.cls === "warn" ? " rs-chip--warn" : (r.dens.cls === "mid" ? " rs-chip--mid" : "");
    var verdictChip = '<span class="rs-chip' + densCls + '">입지 ' + r.dens.label + '</span>'
      + '<span class="rs-chip rs-chip--mid">인허가 ' + r.band.label + '</span>';

    // 종합 판단 문장 — 수치 근거로 자동 구성
    var verdict = "반경 500m 동일 종별(" + selectedCl + ") " + fmt(r.near.sameCl) + "곳 기준으로 입지 경쟁은 ‘" + r.dens.label + "’ 단계입니다. " + r.dens.desc;
    if (r.near.new3 > 0) verdict += " 최근 3년 신규 개원 " + fmt(r.near.new3) + "곳으로 경쟁 유입이 " + (r.near.new3 >= 10 ? "활발합니다." : "이어지고 있습니다.");
    if (r.kw) verdict += " " + kwLabel + "관련 기관은 반경 500m 내 " + fmt(r.near.kwMatch) + "곳입니다.";
    verdict += " 인허가는 입력 조건 기준 ‘" + r.band.label + "’ 난이도로, 아래 " + fmt(r.applied.length) + "개 체크포인트를 작도 전에 확인해야 합니다.";

    var stars = "";
    for (var i = 0; i < 5; i++) stars += '<i class="mr-star' + (i < r.band.stars ? " on" : "") + '">★</i>';

    var topHtml = "";
    if (r.top.length) {
      topHtml = '<div class="mr-top"><h4>반려·지연 다발 — 먼저 확인</h4><ul>'
        + r.top.map(function (t) { return "<li>" + esc(t.text) + "</li>"; }).join("")
        + "</ul></div>";
    }

    // 체크포인트 전체 — 카테고리별 접기
    var byCat = {};
    r.applied.forEach(function (it) { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
    var checksHtml = Object.keys(byCat).map(function (cat) {
      var items = byCat[cat];
      return '<details class="mr-cat"><summary>' + esc(cat) + ' <span>' + items.length + '</span></summary><ul>'
        + items.map(function (it) {
            return "<li>" + (it.reject ? '<em class="mr-flag">반려 다발</em> ' : "") + esc(it.text) + "</li>";
          }).join("")
        + "</ul></details>";
    }).join("");

    var maxBar = Math.max(r.near.total, 1);
    var html = ''
      + '<article class="rs-doc">'
      + '<section class="rs-sec rs-cover">'
      +   '<p class="rs-cover__kicker">BANANAFISH · MY PRE-DIAGNOSIS REPORT</p>'
      +   '<h2 class="rs-cover__title">내 개원 사전진단 리포트</h2>'
      +   '<dl class="rs-cover__meta">'
      +     '<div class="rs-meta"><dt>후보지</dt><dd>' + esc(picked.sido + " " + picked.gu + " " + picked.emd) + '</dd></div>'
      +     '<div class="rs-meta"><dt>종별 · 키워드</dt><dd>' + esc(clKw) + '</dd></div>'
      +     '<div class="rs-meta"><dt>생성 방식</dt><dd>즉석 자동 계산 (브라우저)</dd></div>'
      +     '<div class="rs-meta"><dt>데이터 기준</dt><dd>심평원 ' + esc(today) + '</dd></div>'
      +   '</dl>'
      +   '<p class="rs-verdict"><span class="rs-verdict__label">종합판정</span>' + verdictChip + '</p>'
      + '</section>'

      + '<section class="rs-sec"><h3>01 · 종합 판단</h3><p class="rs-summary">' + verdict + '</p></section>'

      + '<section class="rs-sec"><h3>02 · 입지·경쟁 (반경 집계 실데이터)</h3>'
      +   '<dl class="rs-stats">'
      +     '<div class="rs-stat"><dt>반경 500m 전체</dt><dd>' + fmt(r.near.total) + '</dd></div>'
      +     '<div class="rs-stat rs-stat--hot"><dt>동일 종별 (500m)</dt><dd>' + fmt(r.near.sameCl) + '</dd></div>'
      +     '<div class="rs-stat"><dt>' + (r.kw ? kwLabel + "매칭 (500m)" : "반경 1km 전체") + '</dt><dd>' + fmt(r.kw ? r.near.kwMatch : r.wide.total) + '</dd></div>'
      +     '<div class="rs-stat"><dt>동 전체 의료기관</dt><dd>' + fmt(picked.count) + '</dd></div>'
      +   '</dl>'
      +   '<figure class="rs-fig">'
      +     '<figcaption class="rs-fig__title">반경 500m 경쟁 구성 <span class="rs-fig__total">전체 ' + fmt(r.near.total) + '곳</span></figcaption>'
      +     '<div class="rs-bars">'
      +       bar("500m 전체", r.near.total, maxBar, false)
      +       bar("동일 종별", r.near.sameCl, maxBar, true)
      +       bar("최근 3년 신규", r.near.new3, maxBar, false)
      +       bar("최근 1년 신규", r.near.new1, maxBar, false)
      +     '</div>'
      +   '</figure>'
      +   '<p class="rs-read">간이등급 기준: 반경 500m 동일 종별 0–9곳 여유 · 10–29 보통 · 30–59 밀집 · 60곳 이상 과밀. '
      +   '동 중심점 기준 단순 반경 집계이며, 실제 주소·상권·유동인구 기준 정밀 분석은 1차 검토에서 제공합니다.</p>'
      + '</section>'

      + '<section class="rs-sec"><h3>03 · 인허가 검토 (' + esc(r.band.label) + ' · 체크포인트 ' + fmt(r.applied.length) + '개)</h3>'
      +   '<p class="mr-band">예상 인허가 난이도 <span class="mr-stars">' + stars + '</span> <b>' + esc(r.band.label) + '</b></p>'
      +   topHtml
      +   '<div class="mr-cats">' + checksHtml + '</div>'
      +   '<p class="rs-read">정밀 조건(마약류·재생의료·과목별 특수시설 등)까지 반영한 전체 진단은 <a href="진단.html">무료 사전진단</a>에서 받을 수 있습니다.</p>'
      + '</section>'

      + '<section class="rs-sec rs-next"><h3>04 · 다음 행동</h3>'
      +   '<div class="rs-ctas">'
      +     '<a class="rs-cta rs-cta--primary" href="진단.html#review">'
      +       '<span class="rs-cta__main">공사 계약 없이 1차 검토 신청하기</span>'
      +       '<span class="rs-cta__sub">후보지·도면을 사람이 직접 봅니다 · 신청은 선택</span></a>'
      +     '<a class="rs-cta" href="비교.html">'
      +       '<span class="rs-cta__main">후보지 2~3곳 비교해보기</span>'
      +       '<span class="rs-cta__sub">다른 동과 경쟁 환경을 나란히</span></a>'
      +     '<a class="rs-cta" href="진단.html">'
      +       '<span class="rs-cta__main">정밀 인허가 진단 받기</span>'
      +       '<span class="rs-cta__sub">마약류·재생의료 등 세부 조건 반영</span></a>'
      +   '</div>'
      +   '<p class="rs-trust">진단과 1차 검토는 공사 계약을 전제로 하지 않습니다.</p>'
      + '</section>'

      + '<footer class="rs-foot">'
      +   '<p>데이터: 건강보험심사평가원 · 전국 병의원 및 약국 현황(2026.3.) · 공공누리 제1유형. '
      +   '본 리포트는 자동 계산된 참고용 1차 스크리닝입니다. 최종 인허가 기준은 관할 보건소·소방서·구청 협의로 확정됩니다.</p>'
      + '</footer>'
      + '</div>';

    var box = $("mrReport");
    box.innerHTML = html;
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---- 준비 완료 ----
  $("mrStatus").textContent = "전국 " + fmt(hospitals.length) + "곳 데이터 준비 완료 — 후보지 동을 입력하세요.";
  emdInput.disabled = false;
})();
