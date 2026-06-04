// 병원인텔리전스/assets/diagnose.js
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LS_KEY = "bf_diag_v1";

  // 서버리스 폼 엔드포인트(사용자 설정). 비어 있으면 mailto 폴백 사용.
  var FORM_ENDPOINT = ""; // 예: "https://formspree.io/f/xxxxxx"
  var FALLBACK_EMAIL = "bananafish@naver.com"; // 리드 수신 이메일

  var QUESTIONS = [
    { key:"situation", q:"어떤 상황이세요?", type:"single", options:[
      ["new","신규 개원"],["move","이전"],["expand","증축·확장"],["remodel","리모델링"],["add_dept","진료과목 추가"]] },
    { key:"type", q:"기관 유형은?", type:"single", options:[
      ["clinic","의원"],["hospital","병원"],["general","종합병원"],["dental","치과의원"],["oriental","한의원"],["nursing","요양병원"]] },
    { key:"depts", q:"주요 진료과목 (복수 선택)", type:"multi", options:[
      ["internal","내과"],["ortho","정형외과"],["radiology","영상의학"],["gi","소화기(내시경)"],
      ["nephro","신장(투석)"],["psych","정신건강의학"],["obgyn","산부인과"],["dental","치과"],["oriental","한방"],["etc","기타"]] },
    { key:"inpatient", q:"입원실을 두시나요?", type:"single", options:[
      [0,"아니오"],[4,"예 — 1~4병상"],[10,"예 — 5병상 이상"]] },
    { key:"surgery", q:"수술실/마취 시행 계획은?", type:"single", options:[
      ["none","없음"],["sedation","진정(수면) 마취"],["general","전신마취"]] },
    { key:"radiology", q:"방사선 장비는?", type:"single", options:[
      ["none","없음"],["xray","일반 X-ray"],["ct","CT"],["dental","치과 구내촬영"]] },
    { key:"narcotics", q:"마약류·향정신성의약품을 취급하나요?", type:"bool", options:[[true,"예"],[false,"아니오"]] },
    { key:"regen", q:"첨단재생의료 실시기관 지정을 추진하나요?", type:"bool", options:[[true,"예"],[false,"아니오"]] },
    { key:"building", q:"건물 상태는?", type:"single", options:[
      ["new","신축"],["existing","기존 건물 입주(리모델링)"]] },
    { key:"floors", q:"개원 층은 몇 층인가요?", type:"single", options:[
      [1,"1층(단층)"],[2,"2층"],[3,"3층 이상"]] }
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
    if (qd.key === "inpatient" || qd.key === "floors") return parseInt(raw, 10);
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

    html += renderGate();
    html += '<p class="dg-disclaimer">본 결과는 참고용 1차 진단이며, 최종 적용 기준은 관할기관(보건소·소방서·구청) 협의로 확정됩니다.</p>';
    html += '<div class="dg-restart"><button type="button" class="dg-btn dg-btn--ghost" id="dgRestart">↻ 다시 진단하기</button></div>';

    $("dgQuiz").hidden = true;
    var r = $("dgResult"); r.hidden = false; r.innerHTML = html;
    bindGate(applied, band, score);
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

  function renderGate() {
    return ''
      + '<form class="dg-gate" id="dgGate" novalidate>'
      + '<h3>전체 맞춤 체크리스트 PDF + 무료 1차 검토 받기</h3>'
      + '<label for="gName">성함</label><input type="text" id="gName" name="name" required autocomplete="name" />'
      + '<label for="gPhone">연락처</label><input type="tel" id="gPhone" name="phone" required autocomplete="tel" placeholder="010-0000-0000" />'
      + '<label for="gEmail">이메일</label><input type="email" id="gEmail" name="email" required autocomplete="email" />'
      + '<label class="dg-gate__consent"><input type="checkbox" id="gConsent" required /> <span>개인정보 수집·이용(상담 목적)에 동의합니다.</span></label>'
      + '<button type="submit" class="dg-btn dg-btn--primary" id="gSubmit">맞춤 체크리스트 받기</button>'
      + '<p class="dg-gate__msg" id="gMsg" aria-live="polite"></p>'
      + "</form>";
  }

  function bind() {
    $("dgStart").addEventListener("click", start);
    $("dgStep").addEventListener("click", onPick);
    $("dgNext").addEventListener("click", advance);
    $("dgPrev").addEventListener("click", back);
  }

  function bindGate(applied, band, score) {
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
        난이도: band.label, 점수: score, 체크포인트수: applied.length,
        진단응답: JSON.stringify(state.answers)
      };
      submitBtn.disabled = true; msg.textContent = "전송 중…";
      submitLead(payload).then(function () {
        msg.textContent = "접수되었습니다. 맞춤 체크리스트와 1차 검토 안내를 곧 보내드립니다.";
        try { localStorage.removeItem(LS_KEY); } catch (e2) {}
      }).catch(function () {
        submitBtn.disabled = false;
        var body = encodeURIComponent("개원 인허가 진단 결과\n" + JSON.stringify(payload, null, 2));
        window.location.href = "mailto:" + FALLBACK_EMAIL + "?subject=" +
          encodeURIComponent("[셀프진단] " + name + " 님 인허가 의뢰") + "&body=" + body;
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
