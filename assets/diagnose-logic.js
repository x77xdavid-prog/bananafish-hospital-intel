(function (global) {
  var DEPT_TAG = { nephro:"과목:신장", psych:"과목:정신", obgyn:"과목:산부인",
    gi:"과목:소화기", oriental:"과목:한방", dental:"과목:치과" };

  function deriveActiveTags(a) {
    var t = new Set(["always"]);
    if (a.type === "hospital" || a.type === "general" || a.type === "nursing") t.add("병원급");
    if (a.type === "dental") t.add("과목:치과");
    if (a.type === "oriental") t.add("과목:한방");
    if (a.inpatient && Number(a.inpatient) > 0) t.add("입원실");
    if (a.surgery && a.surgery !== "none") t.add("수술실");  // surgery: 'none'|'sedation'|'general' (sedation=계획된 진정도 수술실 기준 적용)
    if (a.radiology === "xray" || a.radiology === "ct") t.add("방사선");
    if (a.radiology === "ct") t.add("방사선:ct");
    if (a.radiology === "dental") t.add("방사선:치과");
    if (a.radiology === "mri") t.add("mri");                            // MRI는 비전리(납차폐 아님)·자기장/RF 차폐 별도
    if (a.radiology === "ct" || a.radiology === "mri") t.add("중장비");  // 바닥 구조하중·수전 등 대형장비 공통
    if (a.narcotics) t.add("마약류");
    if (a.regen) t.add("재생의료");
    if (a.building === "existing" || a.situation === "remodel") t.add("리모델링");
    var flNum = parseInt(a.floors, 10);
    if (a.floors === "basement" || flNum < 0) t.add("지하");            // 지하층 개설(채광·환기·피난·습기)
    else if (flNum >= 2) t.add("다층");  // 다층 태그는 2층↑(승강기·피난). 난이도 점수 가산은 직통계단 2개소 기준인 3층↑에서만(scoreCase).
    (a.depts || []).forEach(function (d) { if (DEPT_TAG[d]) t.add(DEPT_TAG[d]); });
    return t;
  }

  function scoreCase(a) {
    var base = { clinic:1, dental:1, oriental:1, nursing:2, hospital:2, general:3 };
    var s = base[a.type] || 1;
    if (a.inpatient && Number(a.inpatient) > 0) s += 1;
    if (a.surgery && a.surgery !== "none") s += 1;
    if (a.radiology === "ct" || a.radiology === "mri") s += 1;
    if (a.narcotics) s += 1;
    if (a.regen) s += 1;
    if (a.building === "existing" || a.situation === "remodel") s += 1;
    var flNum = parseInt(a.floors, 10);
    if (a.floors === "basement" || flNum < 0 || flNum >= 3) s += 1;  // 지하 또는 3층↑ 가산
    return s;
  }

  function difficultyBand(score) {
    if (score <= 2) return { stars:1, label:"수월" };
    if (score <= 4) return { stars:3, label:"주의" };
    return { stars:4, label:"까다로움" };
  }

  function matchCheckpoints(a, items) {
    var active = deriveActiveTags(a);
    return items.filter(function (item) {
      var tags = item.tags || [];
      for (var i = 0; i < tags.length; i++) {
        if (active.has(tags[i])) return true;
      }
      return false;
    });
  }

  function topConcerns(applied, n) {
    var limit = (n != null) ? n : 3;
    return applied.filter(function (i) { return i.reject === true; }).slice(0, limit);
  }

  var api = { deriveActiveTags: deriveActiveTags, scoreCase: scoreCase,
    difficultyBand: difficultyBand, matchCheckpoints: matchCheckpoints, topConcerns: topConcerns };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.DiagLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
