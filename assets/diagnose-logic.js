(function (global) {
  var DEPT_TAG = { nephro:"과목:신장", psych:"과목:정신", obgyn:"과목:산부인",
    gi:"과목:소화기", oriental:"과목:한방", dental:"과목:치과" };

  function deriveActiveTags(a) {
    var t = new Set(["always"]);
    if (a.type === "hospital" || a.type === "general" || a.type === "nursing") t.add("병원급");
    if (a.type === "dental") t.add("과목:치과");
    if (a.type === "oriental") t.add("과목:한방");
    if (a.inpatient && Number(a.inpatient) > 0) t.add("입원실");
    if (a.surgery && a.surgery !== "none") t.add("수술실");
    if (a.radiology === "xray" || a.radiology === "ct") t.add("방사선");
    if (a.radiology === "ct") t.add("방사선:ct");
    if (a.radiology === "dental") t.add("방사선:치과");
    if (a.narcotics) t.add("마약류");
    if (a.regen) t.add("재생의료");
    if (a.building === "existing" || a.situation === "remodel") t.add("리모델링");
    if (Number(a.floors) >= 2) t.add("다층");
    (a.depts || []).forEach(function (d) { if (DEPT_TAG[d]) t.add(DEPT_TAG[d]); });
    return t;
  }

  function scoreCase(a) {
    var base = { clinic:1, dental:1, oriental:1, nursing:2, hospital:2, general:3 };
    var s = base[a.type] || 1;
    if (a.inpatient && Number(a.inpatient) > 0) s += 1;
    if (a.radiology === "ct") s += 1;
    if (a.narcotics) s += 1;
    if (a.regen) s += 1;
    if (a.building === "existing" || a.situation === "remodel") s += 1;
    if (Number(a.floors) >= 3) s += 1;
    return s;
  }

  function difficultyBand(score) {
    if (score <= 2) return { stars:1, label:"수월" };
    if (score <= 4) return { stars:3, label:"주의" };
    return { stars:4, label:"까다로움" };
  }

  var api = { deriveActiveTags: deriveActiveTags, scoreCase: scoreCase, difficultyBand: difficultyBand };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.DiagLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
