// 병원인텔리전스/assets/diagnose.js
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LS_KEY = "bf_diag_v1";

  // 서버리스 폼 엔드포인트 — 진단.html의 <meta name="form-endpoint" content="..."> 로 설정.
  // 비어 있으면 mailto 폴백 사용. (예: Formspree "https://formspree.io/f/xxxxxx")
  var FORM_ENDPOINT = (function () {
    var m = document.querySelector('meta[name="form-endpoint"]');
    return m && m.content ? m.content.trim() : "";
  })();
  var FALLBACK_EMAIL = "bananafish@naver.com"; // 리드 수신 이메일(폴백)

  var QUESTIONS = [
    { key:"situation", q:"어떤 상황이세요?", type:"single", options:[
      ["new","신규 개원"],["move","이전"],["expand","증축·확장"],["remodel","리모델링"],["add_dept","진료과목 추가"]] },
    { key:"type", q:"기관 유형은?", type:"single", options:[
      ["clinic","의원"],["dental","치과의원"],["oriental","한의원"],["hospital","병원"],
      ["nursing","요양병원"],["oriental_hospital","한방병원"],["dental_hospital","치과병원"],["general","종합병원"]] },
    { key:"depts", q:"주요 진료과목 (복수 선택)", type:"multi", options:[
      ["internal","내과"],["ortho","정형외과"],["radiology","영상의학"],["gi","소화기(내시경)"],
      ["nephro","신장(투석)"],["psych","정신건강의학"],["obgyn","산부인과"],["dental","치과"],["oriental","한방"],["etc","기타"]] },
    { key:"inpatient", q:"입원실을 두시나요?", type:"single", options:[
      [0,"아니오"],[4,"예 — 1~4병상"],[10,"예 — 5병상 이상"]] },
    { key:"surgery", q:"수술실/마취 시행 계획은?", type:"single", options:[
      ["none","없음"],["sedation","진정(수면) 마취"],["general","전신마취"]] },
    { key:"radiology", q:"영상·방사선 장비는?", type:"single", options:[
      ["none","없음"],["xray","일반 X-ray"],["ct","CT"],["mri","MRI"],["dental","치과 구내촬영"]] },
    { key:"narcotics", q:"마약류·향정신성의약품을 취급하나요?", type:"bool", options:[[true,"예"],[false,"아니오"]] },
    { key:"regen", q:"첨단재생의료 실시기관 지정을 추진하나요?", type:"bool", options:[[true,"예"],[false,"아니오"]] },
    { key:"building", q:"건물 상태는?", type:"single", options:[
      ["new","신축"],["existing","기존 건물 입주(리모델링)"]] },
    { key:"floors", q:"개원 층은 몇 층인가요?", type:"single", options:[
      ["basement","지하"],[1,"1층(단층)"],[2,"2층"],[3,"3층 이상"]] }
  ];

  var DEFAULTS = { situation:"new", type:"clinic", depts:[], inpatient:0, surgery:"none",
    radiology:"none", narcotics:false, regen:false, building:"new", floors:1 };

  var state = { idx:0, answers: load() };

  function load() {
    try { var s = JSON.parse(localStorage.getItem(LS_KEY)); return s && s.answers ? Object.assign({}, DEFAULTS, s.answers) : Object.assign({}, DEFAULTS); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify({ answers: state.answers })); } catch (e) {} }

  function start() { $("dgHero").hidden = true; $("dgQuiz").hidden = false; state.idx = 0; renderStep(); }

  function renderStep() {
    var qd = QUESTIONS[state.idx];
    $("dgBar").style.width = Math.round((state.idx + 1) / QUESTIONS.length * 100) + "%";
    var cur = state.answers[qd.key];
    var html = '<p class="dg-step__q">' + qd.q + '</p>';
    qd.options.forEach(function (opt) {
      var val = opt[0], label = opt[1];
      var pressed = qd.type === "multi" ? (cur.indexOf(val) !== -1) : (cur === val);
      html += '<button type="button" class="dg-opt" data-val="' + String(val) + '" aria-pressed="' + pressed + '">' + label + "</button>";
    });
    if (qd.type !== "multi") html += '<button type="button" class="dg-opt dg-opt--skip" data-skip="1" aria-pressed="false">잘 모르겠어요 / 상담 때 정할게요</button>';
    $("dgStep").innerHTML = html;
    $("dgPrev").disabled = state.idx === 0;
    $("dgNext").textContent = state.idx === QUESTIONS.length - 1 ? "결과 보기" : "다음";
  }

  function onPick(e) {
    var b = e.target.closest(".dg-opt"); if (!b) return;
    var qd = QUESTIONS[state.idx];
    if (b.dataset.skip) { advance(); return; }
    var raw = b.dataset.val;
    var val = parseVal(qd, raw);
    if (qd.type === "multi") {
      var arr = state.answers[qd.key].slice();
      var i = arr.indexOf(val);
      if (i === -1) arr.push(val); else arr.splice(i, 1);
      state.answers[qd.key] = arr;
      save(); renderStep();
    } else {
      state.answers[qd.key] = val; save(); advance();
    }
  }

  function parseVal(qd, raw) {
    if (qd.type === "bool") return raw === "true";
    if (qd.key === "floors") return raw === "basement" ? "basement" : parseInt(raw, 10);
    if (qd.key === "inpatient") return parseInt(raw, 10);
    return raw;
  }

  function advance() { if (state.idx < QUESTIONS.length - 1) { state.idx++; renderStep(); } else { finish(); } }
  function back() { if (state.idx > 0) { state.idx--; renderStep(); } }

  function finish() {
    $("dgBar").style.width = "100%";
    var a = state.answers;
    var score = window.DiagLogic.scoreCase(a);
    var band = window.DiagLogic.difficultyBand(score);
    var applied = window.DiagLogic.matchCheckpoints(a, window.CHECKLIST);
    var top = window.DiagLogic.topConcerns(applied, 3);

    var starsHtml = "";
    for (var i = 0; i < 5; i++) starsHtml += '<i class="dg-star' + (i < band.stars ? " on" : "") + '">★</i>';

    var html = ''
      + '<div class="dg-grade">'
      +   '<span class="dg-grade__label">예상 인허가 난이도</span>'
      +   '<span class="dg-stars">' + starsHtml + '</span>'
      +   '<span class="dg-grade__band band-' + band.stars + '">' + band.label + '</span>'
      + '</div>'
      + '<p class="dg-result__count">내 케이스에 적용되는 인허가 체크포인트 <strong>' + applied.length + '개</strong></p>';

    if (top.length) {
      html += '<div class="dg-top"><h3>먼저 챙겨야 할 주의 항목</h3><ul>';
      top.forEach(function (t) { html += "<li>" + escapeHtml(t.text) + "</li>"; });
      html += "</ul></div>";
    }

    // 적용 체크포인트 전체 목록 — 게이트 없이 항상 전부 공개
    html += renderChecklist(applied);
    // 다음 행동 카드 3개
    html += renderNextCards();
    // 무료 1차 검토 신청(선택) — 결과 열람과 무관
    html += renderReview();
    html += '<p class="dg-disclaimer">본 결과는 참고용 1차 진단입니다. 최종 인허가 기준은 관할 보건소·소방서·구청 협의로 확정됩니다.</p>';
    html += '<div class="dg-restart"><button type="button" class="dg-btn dg-btn--ghost" id="dgRestart">↻ 다시 진단하기</button></div>';

    $("dgQuiz").hidden = true;
    var r = $("dgResult"); r.hidden = false; r.innerHTML = html;
    bindReview(applied, band, score);
    bindGoReview();
    var rb = $("dgRestart");
    if (rb) rb.addEventListener("click", function () {
      state.idx = 0; state.answers = Object.assign({}, DEFAULTS); save();
      r.hidden = true; $("dgQuiz").hidden = true; $("dgHero").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    r.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]; }); }

  // 적용 체크포인트 전체 목록 — 카테고리별 접기(details). 연락처 게이트 없음.
  function renderChecklist(applied) {
    if (!applied.length) return "";
    var order = [], byCat = {};
    applied.forEach(function (it) {
      if (!byCat[it.cat]) { byCat[it.cat] = []; order.push(it.cat); }
      byCat[it.cat].push(it);
    });
    var html = '<div class="dg-list"><h3>적용 체크포인트 전체 목록</h3>';
    order.forEach(function (cat, idx) {
      var items = byCat[cat];
      html += '<details class="dg-cat"' + (idx === 0 ? " open" : "") + '>'
        + '<summary><span class="dg-cat__name">' + escapeHtml(cat) + '</span>'
        + '<span class="dg-cat__n">' + items.length + '</span></summary><ul>';
      items.forEach(function (it) {
        html += '<li' + (it.reject ? ' class="is-reject"' : "") + '>' + escapeHtml(it.text)
          + (it.reject ? ' <em class="dg-flag">반려 다발</em>' : "") + '</li>';
      });
      html += '</ul></details>';
    });
    html += '</div>';
    return html;
  }

  // 결과 하단 다음 행동 카드 3개
  function renderNextCards() {
    return ''
      + '<div class="dg-next"><h3>다음 단계</h3><div class="dg-next__grid">'
      + '<a class="dg-next__card" href="리포트예시.html"><strong>리포트 예시 보기</strong><span>1차 검토 리포트가 어떤 형태로 오는지 미리 확인하세요.</span></a>'
      + '<a class="dg-next__card" href="비교.html"><strong>후보지 2~3곳 비교해보기</strong><span>전국 병·의원 데이터로 후보지별 경쟁 환경을 비교합니다.</span></a>'
      + '<a class="dg-next__card" href="#review" id="dgGoReview"><strong>공사 계약 없이 후보지·도면 1차 검토 신청하기</strong><span>아래 신청 섹션으로 이동합니다. 신청은 선택입니다.</span></a>'
      + '</div></div>';
  }

  // 무료 1차 검토 신청(선택) — 결과를 잠그지 않는 신청 섹션
  function renderReview() {
    return ''
      + '<section class="dg-review" id="review">'
      + '<p class="dg-review__kicker">무료 1차 검토 신청 (선택)</p>'
      + '<h3>공사 계약 없이 후보지·도면 1차 검토 신청하기</h3>'
      + '<p class="dg-review__desc">진단 응답을 바탕으로 후보지·도면의 인허가 검토 포인트를 정리해 안내해 드립니다.</p>'
      + '<p class="dg-trust dg-trust--inline">진단과 1차 검토는 공사 계약을 전제로 하지 않습니다.</p>'
      + '<form class="dg-gate" id="dgGate" novalidate>'
      + '<label for="gName">성함</label><input type="text" id="gName" name="name" required autocomplete="name" />'
      + '<label for="gPhone">연락처</label><input type="tel" id="gPhone" name="phone" required autocomplete="tel" placeholder="010-0000-0000" />'
      + '<label for="gEmail">이메일</label><input type="email" id="gEmail" name="email" required autocomplete="email" />'
      + '<label class="dg-gate__consent"><input type="checkbox" id="gConsent" required /> <span>개인정보 수집·이용(상담 목적)에 동의합니다.</span></label>'
      + '<button type="submit" class="dg-btn dg-btn--primary" id="gSubmit">1차 검토 신청하기</button>'
      + '<p class="dg-gate__msg" id="gMsg" aria-live="polite"></p>'
      + '</form>'
      + '</section>';
  }

  // "1차 검토 신청" 카드 → 신청 섹션으로 부드럽게 스크롤
  function bindGoReview() {
    var go = $("dgGoReview"); if (!go) return;
    go.addEventListener("click", function (e) {
      e.preventDefault();
      var rv = $("review");
      if (rv) rv.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function bind() {
    $("dgStart").addEventListener("click", start);
    $("dgStep").addEventListener("click", onPick);
    $("dgNext").addEventListener("click", advance);
    $("dgPrev").addEventListener("click", back);

    // 외부 페이지(리포트예시/비교)에서 #review 딥링크로 진입 시:
    // 진단 없이도 신청 섹션을 바로 보여준다(결과를 잠그지 않는 V6 원칙의 연장).
    if (location.hash === "#review") showStandaloneReview();
  }

  function showStandaloneReview() {
    var r = $("dgResult");
    r.innerHTML = ''
      + '<p class="dg-review__standalone-note">진단 없이 바로 신청하실 수 있습니다. '
      + '원하시면 <a href="진단.html">무료 사전진단</a>을 먼저 받아보셔도 됩니다.</p>'
      + renderReview();
    r.hidden = false;
    bindReview(null, null, null);
    var rv = $("review");
    if (rv) rv.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindReview(applied, band, score) {
    var form = $("dgGate"); if (!form) return;
    if (form.dataset.bound) return;          // 재진입 시 리스너 중복 방지
    form.dataset.bound = "1";
    var submitBtn = $("gSubmit");
    var msg = $("gMsg");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.textContent = "";
      var name = $("gName").value.trim();
      var phone = $("gPhone").value.trim();
      var email = $("gEmail").value.trim();
      var consent = $("gConsent").checked;
      if (!name || !phone || !email) { msg.textContent = "성함·연락처·이메일을 입력해 주세요."; return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = "이메일 형식을 확인해 주세요."; return; }
      if (!consent) { msg.textContent = "개인정보 수집·이용 동의가 필요합니다."; return; }

      var payload = {
        name: name, phone: phone, email: email,
        난이도: band ? band.label : "미진단", 점수: score == null ? "-" : score,
        체크포인트수: applied ? applied.length : 0,
        진단응답: JSON.stringify(state.answers)
      };
      submitBtn.disabled = true; msg.textContent = "전송 중…";
      submitLead(payload).then(function () {
        msg.textContent = "접수되었습니다. 1차 검토 안내를 곧 보내드립니다.";
        try { localStorage.removeItem(LS_KEY); } catch (e2) {}
      }).catch(function () {
        submitBtn.disabled = false;
        var body = encodeURIComponent("개원 인허가 진단 결과\n" + JSON.stringify(payload, null, 2));
        window.location.href = "mailto:" + FALLBACK_EMAIL + "?subject=" +
          encodeURIComponent("[1차 검토 신청] " + name + " 님") + "&body=" + body;
      });
    });
  }

  function submitLead(payload) {
    if (!FORM_ENDPOINT) return Promise.reject(new Error("no endpoint"));
    return fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) throw new Error("submit failed"); return r; });
  }

  // 외부(테스트/Task7)에서 접근할 수 있도록 노출
  window.BFDiag = { state: state, QUESTIONS: QUESTIONS, start: start, save: save };
  document.addEventListener("DOMContentLoaded", bind);
})();
