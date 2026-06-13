/* 양수 매물 게시판 — 큐레이션 v1
   · listings-data.js(window.HII_LISTINGS) 카드 렌더
   · 각 매물 지역(emd)을 data.js와 매칭해 반경 500m 동일 종별 경쟁도 자동 표시(차별화 포인트)
   · '매물 내놓기' 폼 → Formspree(meta form-endpoint) 또는 mailto 폴백 → 운영자 검수 후 게시
   연락처는 게시판에 노출하지 않으며, 문의는 운영자(바나나피쉬) 경유. */
(function () {
  "use strict";

  var BOX_LAT = 0.02, BOX_LNG = 0.025, EARTH_R = 6371000, RADIUS_M = 500;
  var FALLBACK_EMAIL = "bananafish@naver.com";
  var FORM_ENDPOINT = (function () {
    var m = document.querySelector('meta[name="form-endpoint"]');
    return m && m.content ? m.content.trim() : "";
  })();

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return (n || 0).toLocaleString("ko-KR"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- data.js로 emd 중심점 인덱스(경쟁도 계산용) ----
  var emdCenters = {};   // "sido|gu|emd" → {lat,lng}
  (function buildCenters() {
    var H = window.HII_HOSPITALS;
    if (!H || !H.length) return;
    var acc = {}, i, h, k;
    for (i = 0; i < H.length; i++) {
      h = H[i];
      if (!h.emd || !h.lat || !h.lng) continue;
      k = h.sido + "|" + h.gu + "|" + h.emd;
      if (!acc[k]) acc[k] = { latSum: 0, lngSum: 0, n: 0 };
      acc[k].latSum += h.lat; acc[k].lngSum += h.lng; acc[k].n++;
    }
    for (k in acc) emdCenters[k] = { lat: acc[k].latSum / acc[k].n, lng: acc[k].lngSum / acc[k].n };
  })();

  function haversine(a1, o1, a2, o2) {
    var r = Math.PI / 180, dA = (a2 - a1) * r, dO = (o2 - o1) * r;
    var x = Math.sin(dA / 2) * Math.sin(dA / 2) + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) * Math.sin(dO / 2);
    return 2 * EARTH_R * Math.asin(Math.sqrt(x));
  }
  // 반경 500m 동일 종별 수(경쟁도). 매칭 실패 시 null.
  function sameClNear(item) {
    var H = window.HII_HOSPITALS;
    var c = emdCenters[item.sido + "|" + item.gu + "|" + item.emd];
    if (!H || !c) return null;
    var n = 0, i, h;
    for (i = 0; i < H.length; i++) {
      h = H[i];
      if (h.cl !== item.cl || !h.lat || !h.lng) continue;
      if (h.lat < c.lat - BOX_LAT || h.lat > c.lat + BOX_LAT || h.lng < c.lng - BOX_LNG || h.lng > c.lng + BOX_LNG) continue;
      if (haversine(c.lat, c.lng, h.lat, h.lng) <= RADIUS_M) n++;
    }
    return n;
  }
  function densityLabel(n) {
    if (n == null) return null;
    if (n <= 9) return { t: "여유", cls: "ok" };
    if (n <= 29) return { t: "보통", cls: "mid" };
    if (n <= 59) return { t: "밀집", cls: "warn" };
    return { t: "과밀", cls: "warn" };
  }

  // ---- 카드 렌더 ----
  function rowsDl(pairs) {
    return '<dl class="lst-card__rows">'
      + pairs.filter(function (r) { return r[1]; })
          .map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join("")
      + '</dl>';
  }
  function compHtml(it) {
    var n = sameClNear(it), dens = densityLabel(n);
    return (n == null)
      ? '<span class="lst-comp lst-comp--na">주변 의료 데이터 매칭 안됨</span>'
      : '<span class="lst-comp lst-comp--' + dens.cls + '">반경 500m ' + esc(it.cl) + ' ' + fmt(n) + '곳 · 입지 ' + dens.t + '</span>';
  }
  function foot(it) {
    return '<footer class="lst-card__foot">'
      + '<span class="lst-card__date">게시 ' + esc(it.posted || "") + '</span>'
      + '<a class="lst-card__ask" href="' + askHref(it) + '">문의하기 →</a></footer>';
  }
  function sampleBadge(it) { return it.sample ? '<span class="lst-card__sample">예시</span>' : ''; }
  // 썸네일 — 로드 실패 시 래퍼 자동 제거(깨진 이미지 방지)
  function imgHtml(it) {
    return it.image
      ? '<div class="lst-card__img"><img src="' + esc(it.image) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></div>'
      : '';
  }

  function cardHtml(it) {
    if (it.kind === "매매") return saleCard(it);
    return transferCard(it);
  }

  // 양수(양도양수) 카드 — 권리금·연차 중심
  function transferCard(it) {
    return '<article class="lst-card" data-tilt data-rise>'
      + sampleBadge(it) + imgHtml(it)
      + '<header class="lst-card__head">'
      +   '<p class="lst-card__loc">' + esc(it.sido + " " + it.gu + " " + it.emd) + ' · <b class="lst-kind">양수</b></p>'
      +   '<h3 class="lst-card__title">' + esc(it.cl) + (it.dept ? ' · ' + esc(it.dept) : '') + '</h3>'
      +   compHtml(it)
      + '</header>'
      + rowsDl([
          ["전용 면적", it.area ? it.area + "평" : ""],
          ["개원 연차", it.years != null ? it.years + "년차" : ""],
          ["권리금", it.premium || "협의"],
          ["임대 조건", it.rent || ""],
          ["양도 사유", it.reason || ""]
        ])
      + (it.desc ? '<p class="lst-card__desc">' + esc(it.desc) + '</p>' : '')
      + foot(it);
  }

  // 매매(건물 통매각) 카드 — 매매가·건물 제원 중심
  function saleCard(it) {
    var detail = rowsDl([
      ["대지면적", it.landArea], ["건축면적", it.buildArea], ["주용도", it.usage],
      ["건물규모", it.scale], ["주구조", it.structure], ["주요시설", it.facilities],
      ["주차", it.parking], ["사용승인", it.approval], ["참고", it.note]
    ]);
    return '<article class="lst-card lst-card--sale" data-tilt data-rise>'
      + sampleBadge(it) + imgHtml(it)
      + '<header class="lst-card__head">'
      +   '<p class="lst-card__loc">' + esc(it.sido + " " + it.gu + " " + it.emd) + ' · <b class="lst-kind lst-kind--sale">건물 매매</b></p>'
      +   '<h3 class="lst-card__title">' + esc(it.dept || "의료시설(병원)") + '</h3>'
      +   compHtml(it)
      + '</header>'
      + '<p class="lst-price">매매가 <b>' + esc(it.price || "협의") + '</b></p>'
      + rowsDl([
          ["연면적", it.grossArea], ["용도지역", it.zoning], ["주차", it.parking], ["사용승인", it.approval]
        ])
      + '<details class="lst-more"><summary>건물 제원 상세</summary>' + detail + '</details>'
      + (it.desc ? '<p class="lst-card__desc">' + esc(it.desc) + '</p>' : '')
      + foot(it);
  }
  function askHref(it) {
    var subj = "[매물 문의] " + it.sido + " " + it.gu + " " + it.emd + " " + it.cl + " (" + it.id + ")";
    return "mailto:" + FALLBACK_EMAIL + "?subject=" + encodeURIComponent(subj);
  }

  function renderBoard() {
    var grid = $("lstGrid"), list = window.HII_LISTINGS || [];
    if (!list.length) {
      grid.innerHTML = '<p class="lst-empty">아직 등록된 매물이 없습니다. 아래에서 첫 매물을 내놓아 보세요.</p>';
    } else {
      grid.innerHTML = list.map(cardHtml).join("");
      if (window.FX3D) window.FX3D.apply(grid);
    }
    $("lstCount").textContent = list.length;
  }

  // ---- 매물 내놓기 폼(검수형) ----
  function bindForm() {
    var form = $("lstFormEl"); if (!form) return;
    var msg = $("lstMsg"), btn = $("lstSubmit");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.textContent = "";
      var data = {
        지역: val("fLoc"), 종별: val("fCl"), 진료과목: val("fDept"),
        전용평수: val("fArea"), 개원연차: val("fYears"), 권리금: val("fPremium"),
        양도사유: val("fReason"), 설명: val("fDesc"),
        연락처: val("fContact"), 이메일: val("fEmail")
      };
      if (!data.지역 || !data.종별 || !data.연락처) { msg.textContent = "지역·종별·연락처는 필수입니다."; msg.className = "lst-msg is-err"; return; }
      if (!$("fConsent").checked) { msg.textContent = "개인정보 수집·이용 동의가 필요합니다."; msg.className = "lst-msg is-err"; return; }

      btn.disabled = true; msg.textContent = "접수 중…"; msg.className = "lst-msg";
      submit(data).then(function () {
        msg.textContent = "접수되었습니다. 운영자 검수 후 게시되며, 1~2일 내 연락드립니다."; msg.className = "lst-msg is-ok";
        form.reset();
      }).catch(function () {
        btn.disabled = false;
        var body = "매물 등록 신청\n\n" + Object.keys(data).map(function (k) { return k + ": " + data[k]; }).join("\n");
        window.location.href = "mailto:" + FALLBACK_EMAIL + "?subject=" + encodeURIComponent("[매물 등록] " + data.지역 + " " + data.종별) + "&body=" + encodeURIComponent(body);
      });
    });
  }
  function val(id) { var e = $(id); return e ? e.value.trim() : ""; }
  function submit(payload) {
    if (!FORM_ENDPOINT) return Promise.reject(new Error("no endpoint"));
    return fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) throw new Error("fail"); return r; });
  }

  renderBoard();
  bindForm();
})();
