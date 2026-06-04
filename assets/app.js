/* =====================================================================
   바나나피쉬 병원 인텔리전스 — renderer + map + interactions (vanilla)
   데이터: window.HII_META / HII_HOSPITALS / HII_DEEP
   ===================================================================== */
(function () {
  "use strict";
  var META = window.HII_META || {};
  var HOSP = window.HII_HOSPITALS || [];
  var DEEP = window.HII_DEEP || {};

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function el(id) { return document.getElementById(id); }
  function pad2(n) { return ("0" + n).slice(-2); }
  function fmtNum(n) { return (n == null ? 0 : n).toLocaleString("ko-KR"); }

  var TODAY = "2026-06-04";
  var ERA = { "1": "2025-06-04", "3": "2023-06-04", "5": "2021-06-04" };

  // 종별 → 색 패밀리
  function clKey(cl) {
    if (!cl) return "default";
    if (cl.indexOf("치과") === 0) return "dental";
    if (cl.indexOf("한") === 0 || cl.indexOf("한방") !== -1) return "oriental";
    if (cl === "의원") return "clinic";
    return "hospital"; // 병원/종합병원/상급종합/요양병원/정신병원/보건소 등
  }
  function clColor(cl) { return "var(--cl-" + clKey(cl) + ")"; }

  function deptNames(h, n) {
    var ds = (h.depts || []).map(function (d) { return d[0]; });
    // 중복 제거 + 상위 n
    var seen = {}, out = [];
    for (var i = 0; i < ds.length; i++) { if (!seen[ds[i]]) { seen[ds[i]] = 1; out.push(ds[i]); } }
    return n ? out.slice(0, n) : out;
  }
  function src(url) { return url ? ' <a class="src" href="' + esc(url) + '" target="_blank" rel="noopener">출처</a>' : ""; }
  // 표시용 이름: 심층 별칭 우선, 없으면 선행 법인 접두 제거(공백 필수 → 붙어쓴 명칭은 보존)
  function clean(name) {
    var s = String(name || "").trim();
    s = s.replace(/^\((의|재|사|학|복|특|국|군|공|지)\)\s*/, "");                      // (의) (재) 등 약식 접두
    s = s.replace(/^(재단법인|학교법인|의료법인|사회복지법인|사단법인|특수법인)\S*\s+/, ""); // 법인 접두
    s = s.replace(/^\S*(의료재단|복지재단|학원|재단)\s+/, "");                          // ○○의료재단 등 운영주체
    return s.trim() || String(name || "");
  }
  function displayName(h) { var d = DEEP[h.id]; return (d && d.name) ? d.name : clean(h.name); }

  /* ---------- state ---------- */
  var state = { q: "", gus: {}, types: {}, era: "all", sort: "name", page: 1 };
  var PAGE_SIZE = 50;

  // 검색 인덱스 캐시
  HOSP.forEach(function (h) {
    h._s = (h.name + " " + h.addr + " " + h.gu + " " + deptNames(h).join(" ")).toLowerCase();
    h._deep = !!DEEP[h.id];
  });

  function matches(h) {
    if (state.q && h._s.indexOf(state.q) === -1) return false;
    if (hasKeys(state.gus) && !state.gus[h.gu]) return false;
    if (hasKeys(state.types) && !state.types[h.cl]) return false;
    if (state.era !== "all") {
      if (!h.open) return false;
      if (state.era === "old") { if (h.open >= ERA["5"]) return false; }
      else { if (h.open < ERA[state.era]) return false; }
    }
    return true;
  }
  function hasKeys(o) { for (var k in o) if (o[k]) return true; return false; }

  function filtered() {
    var out = [];
    for (var i = 0; i < HOSP.length; i++) if (matches(HOSP[i])) out.push(HOSP[i]);
    return out;
  }

  function sortRecs(recs) {
    var s = state.sort;
    var c = recs.slice();
    if (s === "name") c.sort(function (a, b) { return a.name.localeCompare(b.name, "ko"); });
    else if (s === "dr_desc") c.sort(function (a, b) { return (b.dr - a.dr) || a.name.localeCompare(b.name, "ko"); });
    else if (s === "open_desc") c.sort(function (a, b) { return cmpOpen(b.open, a.open); });
    else if (s === "open_asc") c.sort(function (a, b) { return cmpOpen(a.open, b.open); });
    return c;
  }
  function cmpOpen(x, y) { // nulls last when ascending sense
    if (!x && !y) return 0; if (!x) return 1; if (!y) return -1;
    return x < y ? -1 : x > y ? 1 : 0;
  }

  /* ---------- filters UI ---------- */
  function buildFilters() {
    // gu
    var guCounts = META.byGu || count("gu");
    el("filtersGu").innerHTML = Object.keys(guCounts).map(function (g) {
      return chip("gu", g, g, guCounts[g]);
    }).join("");
    // type (정렬: 많은 순)
    var tc = META.byType || count("cl");
    var types = Object.keys(tc).sort(function (a, b) { return tc[b] - tc[a]; });
    el("filtersType").innerHTML = types.map(function (t) { return chip("type", t, t, tc[t]); }).join("");
    // era
    var eras = [["all", "전체"], ["1", "최근 1년"], ["3", "최근 3년"], ["5", "최근 5년"], ["old", "그 이전"]];
    el("filtersEra").innerHTML = eras.map(function (e) {
      return '<button class="filter-chip" data-era="' + e[0] + '" aria-pressed="' + (e[0] === "all") + '">' + esc(e[1]) + "</button>";
    }).join("");
  }
  function chip(kind, val, label, n) {
    return '<button class="filter-chip" data-' + kind + '="' + esc(val) + '" aria-pressed="false">' +
      esc(label) + '<span class="filter-chip__n">' + fmtNum(n) + "</span></button>";
  }
  function count(field) {
    var c = {}; HOSP.forEach(function (h) { c[h[field]] = (c[h[field]] || 0) + 1; }); return c;
  }

  /* ---------- map (NAVER Dynamic Map) ---------- */
  var map, clusterer, markerById = {}, infoWindow;
  var curMapRecs = [];
  var GROUPS = { gu: {}, emd: {} };          // key -> {lat,lng,label}
  var regionMarkers = { gu: {}, emd: {} };   // key -> naver Marker
  var GU_MAX_ZOOM = 12;                       // ≤12: 구 / 13~14: 동 / ≥15: 마커 클러스터 (다방식)
  var EMD_MAX_ZOOM = 14;
  function clusterIcon(cls, px) {
    return { content: '<div class="navclust ' + cls + '"><span>0</span></div>',
             size: new naver.maps.Size(px, px), anchor: new naver.maps.Point(px / 2, px / 2) };
  }
  function openInfo(h, m) {
    infoWindow.setContent('<div class="navpop">' + popupHtml(h) + "</div>");
    infoWindow.open(map, m);
  }
  function regionIcon(label, count) {
    return { content: '<div class="region-bubble"><b>' + esc(label) + "</b><i>" + fmtNum(count) + "</i></div>",
             anchor: new naver.maps.Point(0, 0) };
  }
  // 구·동 그룹 중심좌표 계산 + 지역 버블 마커 생성
  function buildGroups() {
    var acc = { gu: {}, emd: {} };
    function add(o, k, label, h) { var a = o[k] || (o[k] = { la: 0, ln: 0, n: 0, label: label }); a.la += h.lat; a.ln += h.lng; a.n++; }
    HOSP.forEach(function (h) {
      add(acc.gu, h.gu, h.gu, h);
      if (h.emd) add(acc.emd, h.gu + "|" + h.emd, h.emd, h);
    });
    ["gu", "emd"].forEach(function (t) {
      Object.keys(acc[t]).forEach(function (k) {
        var a = acc[t][k]; GROUPS[t][k] = { lat: a.la / a.n, lng: a.ln / a.n, label: a.label };
        var rm = new naver.maps.Marker({ position: new naver.maps.LatLng(GROUPS[t][k].lat, GROUPS[t][k].lng), icon: regionIcon(a.label, 0), zIndex: 200 });
        rm.setMap(null);
        naver.maps.Event.addListener(rm, "click", (function (g, tt) {
          return function () { map.morph(new naver.maps.LatLng(g.lat, g.lng), tt === "gu" ? 14 : 16); };
        })(GROUPS[t][k], t));
        regionMarkers[t][k] = rm;
      });
    });
  }
  // 줌 레벨에 따라 구 집계 → 동 집계 → 마커 클러스터로 전환 (다방식)
  function applyMapMode(recs) {
    if (!map || !clusterer) return;
    var z = map.getZoom();
    var tier = z <= GU_MAX_ZOOM ? "gu" : (z <= EMD_MAX_ZOOM ? "emd" : "cluster");
    ["gu", "emd"].forEach(function (t) {
      if (t !== tier) Object.keys(regionMarkers[t]).forEach(function (k) { regionMarkers[t][k].setMap(null); });
    });
    if (tier === "cluster") {
      var ms = [];
      for (var j = 0; j < recs.length; j++) { var mm = markerById[recs[j].id]; if (mm) ms.push(mm); }
      clusterer.setMarkers(ms);
    } else {
      clusterer.setMarkers([]);
      var counts = {};
      for (var i = 0; i < recs.length; i++) { var h = recs[i]; var k = tier === "gu" ? h.gu : h.gu + "|" + h.emd; counts[k] = (counts[k] || 0) + 1; }
      Object.keys(regionMarkers[tier]).forEach(function (k) {
        var rm = regionMarkers[tier][k], c = counts[k] || 0;
        if (c > 0) { rm.setIcon(regionIcon(GROUPS[tier][k].label, c)); rm.setMap(map); } else rm.setMap(null);
      });
    }
    naver.maps.Event.trigger(map, "idle");
  }
  function initMap() {
    map = new naver.maps.Map("map", {
      center: new naver.maps.LatLng(37.553, 126.99),
      zoom: 11, minZoom: 9,
      scaleControl: true, mapDataControl: false, logoControl: true,
      zoomControl: true, zoomControlOptions: { position: naver.maps.Position.RIGHT_TOP }
    });
    infoWindow = new naver.maps.InfoWindow({
      content: "", borderWidth: 0, disableAnchor: true,
      backgroundColor: "transparent", pixelOffset: new naver.maps.Point(0, -4)
    });
    naver.maps.Event.addListener(map, "click", function () { infoWindow.close(); });

    HOSP.forEach(function (h) {
      var deep = h._deep, sz = deep ? 18 : 14;
      var m = new naver.maps.Marker({
        position: new naver.maps.LatLng(h.lat, h.lng), title: h.name,
        icon: { content: '<div class="hmk' + (deep ? " hmk--deep" : "") + '"></div>',
                anchor: new naver.maps.Point(sz / 2, sz / 2) },
        zIndex: deep ? 100 : 50
      });
      naver.maps.Event.addListener(m, "click", (function (hh, mm) {
        return function () { openInfo(hh, mm); };
      })(h, m));
      markerById[h.id] = m;
    });

    clusterer = new MarkerClustering({
      map: map, markers: [], disableClickZoom: false,
      minClusterSize: 2, maxZoom: 15, gridSize: 120, averageCenter: true,
      icons: [clusterIcon("c1", 38), clusterIcon("c2", 44), clusterIcon("c3", 52), clusterIcon("c4", 62)],
      indexGenerator: [10, 50, 200, 1000],
      stylingFunction: function (cm, count) {
        var s = cm.getElement().querySelector("span"); if (s) s.textContent = count;
      }
    });

    buildGroups();
    naver.maps.Event.addListener(map, "zoom_changed", function () { applyMapMode(curMapRecs); });
  }

  // 최신 확인 — 외부 공개 출처(네이버 검색/지도/뉴스/공식 홈페이지)를 새 탭으로 열어 최신 정보 확인
  function latestLinksHtml(h) {
    var nm = displayName(h), q = encodeURIComponent(nm + " " + h.gu);
    function a(href, label) { return '<a href="' + esc(href) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' + label + "</a>"; }
    return '<div class="latest"><span class="latest__label">최신 확인 ↻</span>' +
      a("https://search.naver.com/search.naver?query=" + q, "검색") +
      a("https://map.naver.com/p/search/" + encodeURIComponent(nm), "지도") +
      a("https://search.naver.com/search.naver?where=news&query=" + encodeURIComponent(nm), "뉴스") +
      (h.url ? a(h.url, "홈페이지") : "") + "</div>";
  }
  function popupHtml(h) {
    var depts = deptNames(h, 4).join(" · ") || "—";
    var tag = h._deep ? '<span class="pop__tag">심층</span>' : "";
    var btn = h._deep
      ? '<a class="pop__btn" href="#deep-' + h.id + '" data-deepgo="' + h.id + '">심층 도시에 보기 →</a>'
      : (h.url ? '<a class="pop__btn" href="' + esc(h.url) + '" target="_blank" rel="noopener">홈페이지 →</a>' : "");
    return '<div class="pop__name">' + esc(displayName(h)) + tag + "</div>" +
      '<div class="pop__meta">' + esc(h.cl) + " · " + esc(h.gu) + (h.open ? " · 개원 " + esc(h.open) : "") + "</div>" +
      '<div class="pop__row"><b>진료</b> ' + esc(depts) + "</div>" +
      '<div class="pop__row"><b>의사</b> ' + fmtNum(h.dr) + "명" + (h.tel ? ' · <b>☎</b> ' + esc(h.tel) : "") + "</div>" +
      '<div class="pop__row" style="color:var(--ink-faint)">' + esc(h.addr) + "</div>" + btn + latestLinksHtml(h);
  }

  function updateMap(recs) {
    if (!clusterer) return;
    curMapRecs = recs;
    applyMapMode(recs);
    el("mapCount").textContent = fmtNum(recs.length);
  }

  function focusHospital(h) {
    var m = markerById[h.id];
    if (!m || !map) return;
    document.querySelector(".mapsection").scrollIntoView({ behavior: "smooth", block: "start" });
    map.setCenter(m.getPosition());
    map.setZoom(17);
    setTimeout(function () { openInfo(h, m); }, 320);
  }

  /* ---------- directory ---------- */
  var curRecs = [];
  function renderDirectory() {
    curRecs = sortRecs(filtered());
    var total = curRecs.length;
    el("dirCount").textContent = fmtNum(total);
    el("resultCount").textContent = fmtNum(total) + " / " + fmtNum(HOSP.length) + "곳";
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * PAGE_SIZE;
    var slice = curRecs.slice(start, start + PAGE_SIZE);

    el("emptyState").hidden = total !== 0;
    el("dirBody").innerHTML = slice.map(function (h, i) {
      var deptTxt = deptNames(h, 3).join(", ") || "—";
      return '<div class="dirrow dirrow--data' + (h._deep ? " dirrow--deep" : "") + '" role="row" data-id="' + h.id + '" style="--sec:' + clColor(h.cl) + '">' +
        '<span class="c-name" role="cell">' + (h._deep ? '<span class="deepbadge">심층</span>' : "") + '<span class="nm">' + esc(displayName(h)) + "</span></span>" +
        '<span class="c-type" role="cell"><span class="cltag">' + esc(h.cl) + "</span></span>" +
        '<span class="c-gu" role="cell">' + esc(h.gu) + "</span>" +
        '<span class="c-open" role="cell">' + esc(h.open || "—") + "</span>" +
        '<span class="c-dr" role="cell">' + fmtNum(h.dr) + "</span>" +
        '<span class="c-dept" role="cell">' + esc(deptTxt) + "</span></div>";
    }).join("");

    renderPager(pages);
    updateMap(curRecs);
  }

  function renderPager(pages) {
    if (pages <= 1) { el("pager").innerHTML = ""; return; }
    var p = state.page, out = [];
    out.push(pbtn("‹", p - 1, p === 1, false, "이전"));
    var win = pageWindow(p, pages);
    win.forEach(function (n) {
      if (n === "…") out.push('<span class="pager__ellip">…</span>');
      else out.push(pbtn(String(n), n, false, n === p, "페이지 " + n));
    });
    out.push(pbtn("›", p + 1, p === pages, false, "다음"));
    el("pager").innerHTML = out.join("");
  }
  function pbtn(label, page, disabled, current, aria) {
    return '<button class="pager__btn" data-page="' + page + '"' + (disabled ? " disabled" : "") +
      (current ? ' aria-current="true"' : "") + ' aria-label="' + esc(aria) + '">' + esc(label) + "</button>";
  }
  function pageWindow(p, pages) {
    var s = new Set([1, 2, pages - 1, pages, p - 1, p, p + 1]);
    var arr = [];
    for (var i = 1; i <= pages; i++) if (s.has(i) && i >= 1 && i <= pages) arr.push(i);
    var out = [];
    for (var j = 0; j < arr.length; j++) { if (j && arr[j] - arr[j - 1] > 1) out.push("…"); out.push(arr[j]); }
    return out;
  }

  /* ---------- deep dossiers ---------- */
  function block(num, title, body, wide) {
    return '<section class="block' + (wide ? " block--wide" : "") + '">' +
      '<h3 class="block__label"><span class="num">' + num + "</span>" + esc(title) + "</h3>" + body + "</section>";
  }

  function deptComposition(h) {
    var withSp = (h.depts || []).filter(function (d) { return d[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var plain = deptNames(h);
    var chips;
    if (withSp.length) {
      chips = withSp.map(function (d) { return '<span class="deptchip">' + esc(d[0]) + ' <b>' + d[1] + "명</b></span>"; }).join("");
    } else {
      chips = plain.map(function (n) { return '<span class="deptchip">' + esc(n) + "</span>"; }).join("");
    }
    return chips || '<span class="block__text">공개된 진료과목 정보가 없습니다.</span>';
  }

  function renderDeep() {
    var ids = Object.keys(DEEP).filter(function (id) { return byId[id]; });
    // 정렬: 고정(pin) 우선 → 의사수 desc
    ids.sort(function (a, b) {
      var pa = DEEP[a].pin || 0, pb = DEEP[b].pin || 0;
      if (pa !== pb) return pb - pa;
      return byId[b].dr - byId[a].dr;
    });
    var host = el("deepList");
    if (!ids.length) {
      host.innerHTML = '<p class="empty-state">심층 도시에는 순차적으로 추가됩니다.</p>';
      return;
    }
    var n = 0;
    ids.forEach(function (id) {
      var h = byId[id], d = DEEP[id];
      if (!matches(h)) return; // 필터 적용
      n++;
      host.appendChild(deepCard(h, d, n));
    });
    if (!n) host.innerHTML = '<p class="empty-state">현재 필터에 해당하는 심층 도시에가 없습니다.</p>';
  }

  function deepCard(h, d, idx) {
    var depts = deptNames(h, 6);
    // 01 진료 내용
    var treat = (d.treatments && d.treatments.length)
      ? '<p class="block__text">' + esc(d.summary || "") + src(d.summarySrc) + "</p>" +
        '<div class="featlist">' + d.treatments.map(function (t) {
          return '<div class="feat"><span class="feat__name">' + esc(t.name) + "</span>" +
            '<span class="feat__desc">' + esc(t.desc || "") + src(t.src) + "</span></div>";
        }).join("") + "</div>"
      : '<p class="block__text">' + esc(d.summary || "주요 진료과목 기준 정리입니다.") + "</p>" +
        '<div class="deptchips">' + depts.map(function (x) { return '<span class="deptchip">' + esc(x) + "</span>"; }).join("") + "</div>";

    // 02 의사 구성
    var docBody = '<p class="block__text" style="margin-bottom:.8rem"><strong>총 의사</strong> ' + fmtNum(h.dr) + "명" +
      (h.sp ? " · 전문의 " + fmtNum(h.sp) + "명" : "") + '</p><div class="deptchips">' + deptComposition(h) + "</div>";
    if (d.doctors && d.doctors.length) {
      docBody += '<div class="people" style="margin-top:1rem">' + d.doctors.map(function (m) {
        var av = m.name ? esc(m.name.charAt(0)) : "·";
        return '<div class="person"><div class="person__av">' + av + "</div><div>" +
          '<div><span class="person__name">' + esc(m.name) + "</span>" +
          (m.role ? '<span class="person__role">' + esc(m.role) + "</span>" : "") + "</div>" +
          (m.note ? '<div class="person__note">' + esc(m.note) + src(m.src) + "</div>" : "") + "</div></div>";
      }).join("") + "</div>";
    }

    // 03 원장 이력
    var dirBody = "";
    if (d.directors && d.directors.length) {
      dirBody = (d.directorName ? '<p class="block__text" style="margin-bottom:.8rem"><strong>' + esc(d.directorName) + "</strong>" + (d.directorRole ? " · " + esc(d.directorRole) : "") + "</p>" : "") +
        '<div class="timeline">' + d.directors.map(function (t) {
          return '<div class="tl"><div class="tl__year">' + esc(t.year) + '</div><div class="tl__text">' + esc(t.text) + src(t.src) + "</div></div>";
        }).join("") + "</div>";
    } else {
      dirBody = '<p class="block__text">공개된 원장 이력 정보가 제한적입니다. 공식 홈페이지를 확인하세요.' + (h.url ? src(h.url) : "") + "</p>";
    }

    // 04 뉴스
    var newsBody = (d.news && d.news.length)
      ? '<div class="news">' + d.news.map(function (nws) {
          return '<a class="news__item" href="' + esc(nws.url) + '" target="_blank" rel="noopener">' +
            '<span class="news__date">' + esc(nws.date || "") + "</span>" +
            '<span class="news__outlet">' + esc(nws.outlet || "") + "</span>" +
            '<span class="news__title">' + esc(nws.title) + "</span><span class=\"news__arrow\">↗</span></a>";
        }).join("") + "</div>"
      : '<p class="block__text">최근 공개 뉴스가 확인되지 않았습니다.</p>';

    // 05 채용
    var hire = d.hiring || {};
    var hireBody =
      (hire.roles && hire.roles.length ? '<div class="roles">' + hire.roles.map(function (r) { return '<span class="role">' + esc(r) + "</span>"; }).join("") + "</div>" : "") +
      (hire.note ? '<p class="block__text" style="margin-bottom:1rem">' + esc(hire.note) + "</p>" : (hire.roles ? "" : '<p class="block__text" style="margin-bottom:1rem">상시 채용 여부는 공식 채용 페이지에서 확인하세요.</p>')) +
      (hire.url ? '<a class="btn-link" href="' + esc(hire.url) + '" target="_blank" rel="noopener">채용 페이지 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>'
        : (h.url ? '<a class="btn-link" href="' + esc(h.url) + '" target="_blank" rel="noopener">공식 홈페이지 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>' : ""));

    // sources
    var srcList = (d.sources || []).map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a>"; }).join("");
    var srcBlock = (d.sources && d.sources.length)
      ? '<div class="sources block--wide"><details><summary class="sources__sum">출처 ' + d.sources.length + '건 보기</summary><div class="sources__list">' + srcList + "</div></details></div>"
      : "";

    var chips =
      '<span class="tag tag--sector">' + esc(h.cl) + "</span>" +
      (h._deep && d.badge ? '<span class="tag tag--new">' + esc(d.badge) + "</span>" : "") +
      (h.url ? '<a class="tag tag--home" href="' + esc(h.url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">홈페이지 ↗</a>' : "");

    var keyfacts =
      '<div><dt>개원일</dt><dd>' + esc(h.open || "—") + "</dd></div>" +
      '<div><dt>종별</dt><dd>' + esc(h.cl) + "</dd></div>" +
      '<div><dt>의사수</dt><dd>' + fmtNum(h.dr) + "명</dd></div>" +
      '<div><dt>소재</dt><dd>' + esc(h.gu) + "</dd></div>";

    var head =
      '<button class="dossier__head" type="button" aria-expanded="false" aria-controls="body-' + h.id + '">' +
        '<div class="monogram" aria-hidden="true">' + esc(displayName(h).charAt(0)) + "</div>" +
        '<div class="head-main"><div class="head-titlerow">' +
          '<span class="head-index">' + pad2(idx) + "</span>" +
          '<span class="dossier__name">' + esc(displayName(h)) + "</span></div>" +
          '<p class="dossier__tagline">' + esc(d.tagline || (h.cl + " · " + h.gu + " · " + (deptNames(h, 3).join(", ") || ""))) + "</p>" +
          '<div class="head-chips">' + chips + "</div>" + latestLinksHtml(h) + "</div>" +
        '<div class="head-right"><dl class="keyfacts">' + keyfacts + "</dl>" +
          '<span class="chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></span>' + "</div>" +
      "</button>";

    var body =
      '<div class="dossier__body" id="body-' + h.id + '"><div class="dossier__body-inner"><div class="blocks">' +
        '<dl class="keyfacts-mobile">' + keyfacts + "</dl>" +
        block("01", "진료 내용", treat, true) +
        block("02", "의사 구성", docBody, false) +
        block("03", "원장 이력", dirBody, false) +
        block("04", "뉴스", newsBody, true) +
        block("05", "채용", hireBody, false) +
        srcBlock +
      "</div></div></div>";

    var art = document.createElement("article");
    art.className = "dossier reveal";
    art.id = "deep-" + h.id;
    art.style.setProperty("--sec", clColor(h.cl));
    art.innerHTML = head + body;
    return art;
  }

  /* ---------- interactions ---------- */
  function setOpen(dossier, open) {
    dossier.classList.toggle("is-open", open);
    var btn = dossier.querySelector(".dossier__head");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function refresh(resetPage) {
    if (resetPage) state.page = 1;
    renderDirectory();
    // deep: re-render under filter
    el("deepList").innerHTML = "";
    renderDeep();
    initReveal();
  }

  function bindToolbar() {
    var s = el("search"), deb;
    s.addEventListener("input", function () {
      clearTimeout(deb);
      deb = setTimeout(function () { state.q = s.value.trim().toLowerCase(); refresh(true); }, 130);
    });

    el("filterbar").addEventListener("click", function (e) {
      var c = e.target.closest(".filter-chip"); if (!c) return;
      if (c.dataset.gu !== undefined) toggleSet(state.gus, c.dataset.gu, c);
      else if (c.dataset.type !== undefined) toggleSet(state.types, c.dataset.type, c);
      else if (c.dataset.era !== undefined) selectEra(c.dataset.era);
      refresh(true);
    });

    el("sortSel").addEventListener("change", function () { state.sort = this.value; refresh(false); });

    el("resetBtn").addEventListener("click", function () {
      state = { q: "", gus: {}, types: {}, era: "all", sort: state.sort, page: 1 };
      el("search").value = "";
      document.querySelectorAll("#filterbar .filter-chip").forEach(function (c) {
        c.setAttribute("aria-pressed", c.dataset.era === "all" ? "true" : "false");
      });
      refresh(true);
    });

    el("pager").addEventListener("click", function (e) {
      var b = e.target.closest(".pager__btn"); if (!b || b.disabled) return;
      state.page = parseInt(b.dataset.page, 10); renderDirectory();
      el("directorySection").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    el("dirBody").addEventListener("click", function (e) {
      var row = e.target.closest(".dirrow--data"); if (!row) return;
      var h = byId[row.dataset.id]; if (!h) return;
      if (h._deep) gotoDeep(h.id); else focusHospital(h);
    });

    // popup → deep link
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-deepgo]"); if (!a) return;
      e.preventDefault(); gotoDeep(a.dataset.deepgo);
    });

    // to-top
    var toTop = el("toTop");
    window.addEventListener("scroll", function () { toTop.hidden = window.scrollY < 600; }, { passive: true });
    toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  function toggleSet(setObj, key, chipEl) {
    if (setObj[key]) { delete setObj[key]; chipEl.setAttribute("aria-pressed", "false"); }
    else { setObj[key] = 1; chipEl.setAttribute("aria-pressed", "true"); }
  }
  function selectEra(val) {
    state.era = val;
    el("filtersEra").querySelectorAll(".filter-chip").forEach(function (c) {
      c.setAttribute("aria-pressed", c.dataset.era === val ? "true" : "false");
    });
  }

  function gotoDeep(id) {
    var card = el("deep-" + id);
    if (!card) { // 필터에 가려졌으면 초기화 후 재시도
      state = { q: "", gus: {}, types: {}, era: "all", sort: state.sort, page: 1 };
      el("search").value = "";
      document.querySelectorAll("#filterbar .filter-chip").forEach(function (c) {
        c.setAttribute("aria-pressed", c.dataset.era === "all" ? "true" : "false");
      });
      refresh(true);
      card = el("deep-" + id);
    }
    if (card) {
      bindDeepToggles(card);
      setOpen(card, true);
      if (map) map.closePopup();
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bindDeepToggles(scope) {
    (scope || document).querySelectorAll(".dossier__head").forEach(function (btn) {
      if (btn._bound) return; btn._bound = 1;
      btn.addEventListener("click", function () {
        var d = btn.closest(".dossier"); setOpen(d, !d.classList.contains("is-open"));
      });
    });
  }

  /* ---------- reveal ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal:not(.in)");
    if (!("IntersectionObserver" in window)) { items.forEach(function (i) { i.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (i) { io.observe(i); });
  }

  /* ---------- boot ---------- */
  var byId = {};
  function boot() {
    HOSP.forEach(function (h) { byId[h.id] = h; });
    var deepCount = Object.keys(DEEP).filter(function (id) { return byId[id]; }).length;

    document.querySelectorAll("[data-stat]").forEach(function (n) {
      var k = n.dataset.stat;
      if (k === "total") n.textContent = fmtNum(META.total || HOSP.length);
      else if (k === "deep") n.textContent = deepCount;
      else if (k === "version") n.textContent = META.version || "";
      else if (k === "generated") n.textContent = META.generated || "";
    });

    buildFilters();
    initMap();
    bindToolbar();
    renderDirectory();
    renderDeep();
    bindDeepToggles(document);
    initReveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
