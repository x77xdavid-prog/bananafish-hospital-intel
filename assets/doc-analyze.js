/* 서류 자동 인식 — 업로드 → /api/extract 호출 → 결과 렌더 */
(function () {
  "use strict";

  // 백엔드 주소 결정 우선순위:
  //  1) <meta name="ocr-backend" content="https://...">  (배포 후 여기에 백엔드 URL 입력)
  //  2) 로컬에서 Flask가 함께 서빙 중이면 same-origin('')
  //  3) 그 외(정적 호스팅)에서는 로컬 백엔드(localhost:8000) 시도 → 없으면 안내 배너
  var isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var META = document.querySelector('meta[name="ocr-backend"]');
  var BACKEND = META && META.content ? META.content.trim() : "";
  var API = BACKEND || (isLocal ? "" : "http://localhost:8000");

  var FALLBACK_TYPES = ["사업자등록증", "도면/평면도", "의료기관 인허가·법적 서류", "계약서·임대차", "신분증·자격증"];

  var el = {
    drop: document.getElementById("daDrop"),
    file: document.getElementById("daFile"),
    filename: document.getElementById("daFilename"),
    status: document.getElementById("daStatus"),
    result: document.getElementById("daResult"),
    badge: document.getElementById("daBadge"),
    fields: document.getElementById("daFields"),
    raw: document.getElementById("daRaw"),
    reset: document.getElementById("daReset"),
    types: document.getElementById("daTypes"),
    saved: document.getElementById("daSaved"),
    correctType: document.getElementById("daCorrectType"),
    correctKw: document.getElementById("daCorrectKw"),
    correctBtn: document.getElementById("daCorrectBtn"),
    correctMsg: document.getElementById("daCorrectMsg"),
    correctPanel: document.getElementById("daCorrectPanel"),
  };

  // 화면 상태: 인식 가능한 문서종류 목록 + 마지막 분석 결과
  var state = { doctypes: [], last: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function show(node) { node.hidden = false; }
  function hide(node) { node.hidden = true; }

  // ---- 인식 가능 문서 종류 칩 ----
  function renderTypes(list) {
    el.types.innerHTML = list
      .map(function (t) { return '<span class="da-type">' + esc(t) + "</span>"; })
      .join("");
  }

  function loadHealth() {
    fetch(API + "/api/health")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.doctypes && d.doctypes.length) {
          state.doctypes = d.doctypes;
          renderTypes(d.doctypes.map(function (x) { return x.name; }));
        } else {
          renderTypes(FALLBACK_TYPES);
          if (!isLocal) showBackendNotice();
        }
      })
      .catch(function () {
        renderTypes(FALLBACK_TYPES);
        if (!isLocal) showBackendNotice();
      });
  }

  // 라이브(정적 호스팅) 환경: OCR 백엔드가 없으므로 안내 배너 표시
  function showBackendNotice() {
    el.status.innerHTML =
      '<div class="da-error" style="background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent-deep)">' +
      "<b>ℹ️ 문서 인식은 현재 ‘로컬 실행’ 전용입니다.</b><br>" +
      "이 기능은 PaddleOCR 분석 서버가 필요해 정적 호스팅(GitHub Pages)에서는 동작하지 않습니다. " +
      "데모 UI는 둘러보실 수 있어요. 실제 인식은 로컬에서 <code>python ocr/server.py</code> 실행 후 " +
      "<code>http://localhost:8000/서류분석.html</code> 로 이용하세요." +
      "</div>";
    show(el.status);
  }

  // 교정 패널의 종류 select 채우기 (현재 분류를 기본 선택)
  function fillCorrectSelect(selectedId) {
    if (!state.doctypes.length) {
      el.correctType.innerHTML = '<option value="">(서버 연결 후 표시)</option>';
      return;
    }
    el.correctType.innerHTML = state.doctypes
      .map(function (t) {
        var sel = t.id === selectedId ? " selected" : "";
        return '<option value="' + esc(t.id) + '"' + sel + ">" + esc(t.name) + "</option>";
      })
      .join("");
  }

  // ---- 상태 표시 ----
  function setLoading(name) {
    hide(el.result);
    el.status.innerHTML =
      '<div class="da-loading"><span class="da-spin"></span>' +
      "<span>" + esc(name) + " 인식 중… (첫 분석은 모델 로딩으로 조금 걸립니다)</span></div>";
    show(el.status);
  }

  function setError(msg, hint) {
    hide(el.result);
    var h = hint ? "<br>" + hint : "";
    el.status.innerHTML = '<div class="da-error"><b>분석할 수 없습니다.</b><br>' + esc(msg) + h + "</div>";
    show(el.status);
  }

  function serverDownHint() {
    return (
      "분석 서버가 꺼져 있는 것 같아요. 터미널에서 아래를 실행한 뒤 " +
      "<code>http://localhost:8000/서류분석.html</code> 로 다시 여세요.<br>" +
      "<code>cd ocr</code> → <code>python server.py</code>"
    );
  }

  // ---- 결과 렌더 ----
  function renderResult(d) {
    hide(el.status);

    var confident = !!d.confident && d.doctype_name;
    var typeName = d.doctype_name || "미분류";
    var confClass = confident ? "da-badge__conf--ok" : "da-badge__conf--low";
    var confText = confident ? "분류 확실" : "확인 필요";

    el.badge.innerHTML =
      '<span class="da-badge__type">' + esc(typeName) + "</span>" +
      '<span class="da-badge__conf ' + confClass + '">' + confText + "</span>";

    var fields = d.fields || {};
    var keys = Object.keys(fields);
    if (keys.length) {
      el.fields.innerHTML = keys
        .map(function (k) {
          return (
            '<div class="da-field"><div class="da-field__k">' + esc(k) +
            '</div><div class="da-field__v">' + esc(fields[k]) + "</div></div>"
          );
        })
        .join("");
    } else {
      el.fields.innerHTML =
        '<div class="da-empty-fields">분류는 됐지만 추출할 항목 규칙이 아직 없습니다.</div>';
    }

    // 저신뢰 시 후보 표시
    var candHtml = "";
    if (!confident && d.candidates && d.candidates.length) {
      candHtml =
        '<div class="da-cand">가까운 후보:' +
        d.candidates
          .map(function (c) {
            return '<span class="da-cand__chip">' + esc(c.name) + " · " + esc(c.score) + "점</span>";
          })
          .join("") +
        "</div>";
    }
    // 후보를 fields 블록 뒤에 붙임(중복 방지 위해 기존 것 제거 후)
    var old = el.result.querySelector(".da-cand");
    if (old) old.remove();
    if (candHtml) el.fields.insertAdjacentHTML("afterend", candHtml);

    el.raw.textContent = d.text || "(원문 없음)";

    // 추출 텍스트 저장 위치 표시
    if (el.saved) {
      if (d.saved) {
        el.saved.innerHTML = "💾 추출 텍스트 저장됨 · <code>" + esc(d.saved) + "</code>";
        show(el.saved);
      } else {
        hide(el.saved);
      }
    }

    // 교정 패널 준비: 마지막 결과 저장 + 종류 select 채우기 + 메시지 초기화
    state.last = { text: d.text || "", source: d.source || "(web)", predicted_id: d.doctype_id || null };
    fillCorrectSelect(d.doctype_id);
    hide(el.correctMsg);
    if (el.correctKw) el.correctKw.value = "";

    show(el.result);
  }

  // ---- 교정 → 학습 ----
  function learn() {
    if (!state.last || !state.last.text) return;
    var correctId = el.correctType.value;
    if (!correctId) { showCorrectMsg("문서 종류를 먼저 선택하세요.", false); return; }

    var keywords = (el.correctKw.value || "")
      .split(/[,\n]/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    el.correctBtn.disabled = true;
    el.correctBtn.textContent = "학습 중…";

    fetch(API + "/api/correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: state.last.text,
        source: state.last.source,
        predicted_id: state.last.predicted_id,
        correct_id: correctId,
        keywords: keywords,
      }),
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok) { showCorrectMsg(res.body && res.body.error ? res.body.error : "학습 실패", false); return; }
        var added = (res.body.added_keywords || []).length;
        var msg = "✅ 학습 완료 · 지식베이스 v" + res.body.kb_version +
          (added ? " · 키워드 " + added + "개 추가" : "");
        // 갱신된 KB로 재분석된 결과를 다시 렌더(메시지는 렌더 후 표시)
        if (res.body.result) {
          renderResult(res.body.result);
          el.correctPanel.open = true;
        }
        showCorrectMsg(msg, true);
      })
      .catch(function () { showCorrectMsg("서버에 연결하지 못했습니다.", false); })
      .finally(function () {
        el.correctBtn.disabled = false;
        el.correctBtn.textContent = "학습시키기";
      });
  }

  function showCorrectMsg(text, ok) {
    el.correctMsg.textContent = text;
    el.correctMsg.className = "da-correct__msg " + (ok ? "is-ok" : "is-err");
    show(el.correctMsg);
  }

  // ---- 업로드 ----
  function upload(file) {
    if (!file) return;
    el.filename.textContent = "📄 " + file.name;
    show(el.filename);
    setLoading(file.name);

    var fd = new FormData();
    fd.append("file", file);

    fetch(API + "/api/extract", { method: "POST", body: fd })
      .then(function (r) {
        return r.json().then(function (body) { return { ok: r.ok, body: body }; });
      })
      .then(function (res) {
        if (!res.ok) { setError(res.body && res.body.error ? res.body.error : "서버 오류"); return; }
        renderResult(res.body);
      })
      .catch(function () { setError("서버에 연결하지 못했습니다.", serverDownHint()); });
  }

  // ---- 이벤트 바인딩 ----
  el.file.addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) upload(e.target.files[0]);
  });

  ["dragenter", "dragover"].forEach(function (ev) {
    el.drop.addEventListener(ev, function (e) {
      e.preventDefault(); e.stopPropagation();
      el.drop.classList.add("is-drag");
    });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    el.drop.addEventListener(ev, function (e) {
      e.preventDefault(); e.stopPropagation();
      el.drop.classList.remove("is-drag");
    });
  });
  el.drop.addEventListener("drop", function (e) {
    var dt = e.dataTransfer;
    if (dt && dt.files && dt.files[0]) upload(dt.files[0]);
  });
  el.drop.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.file.click(); }
  });

  el.reset.addEventListener("click", function () {
    el.file.value = "";
    hide(el.result); hide(el.status); hide(el.filename);
  });

  el.correctBtn.addEventListener("click", learn);
  el.correctKw.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); learn(); }
  });

  loadHealth();
})();
