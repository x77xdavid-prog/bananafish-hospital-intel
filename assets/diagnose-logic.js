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

  var api = { deriveActiveTags: deriveActiveTags };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.DiagLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
