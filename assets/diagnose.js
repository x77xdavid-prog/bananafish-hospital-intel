// 병원인텔리전스/assets/diagnose.js
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LS_KEY = "bf_diag_v1";

  // 서버리스 폼 엔드포인트(사용자 설정). 비어 있으면 mailto 폴백 사용.
  var FORM_ENDPOINT = ""; // 예: "https://formspree.io/f/xxxxxx"
  var FALLBACK_EMAIL = "bansnsfish@naver.com"; // 리드 수신 이메일

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
    radiology:"none", narcotics:false, regen:false, building:"new", floors:1, region:"" };

  var state = { idx:0, answers: load() };

  function load() {
    try { var s = JSON.parse(localStorage.getItem(LS_KEY)); return s && s.answers ? Object.assign({}, DEFAULTS, s.answers) : Object.assign({}, DEFAULTS); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify({ answers: state.answers })); } catch (e) {} }

  function start() { $("dgHero").hidden = true; $("dgQuiz").hidden = false; state.idx = 0; renderStep(); }

  function renderStep() {
    var qd = QUESTIONS[state.idx];
    $("dgBar").style.width = Math.round((state.idx) / QUESTIONS.length * 100) + "%";
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

  function finish() { /* Task 7에서 구현 */ window.__dgFinish && window.__dgFinish(state.answers); }

  function bind() {
    $("dgStart").addEventListener("click", start);
    $("dgStep").addEventListener("click", onPick);
    $("dgNext").addEventListener("click", advance);
    $("dgPrev").addEventListener("click", back);
  }

  // 외부(테스트/Task7)에서 접근할 수 있도록 노출
  window.BFDiag = { state: state, QUESTIONS: QUESTIONS, start: start, save: save };
  document.addEventListener("DOMContentLoaded", bind);
})();
