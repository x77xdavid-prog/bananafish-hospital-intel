const test = require("node:test");
const assert = require("node:assert");
const L = require("../assets/diagnose-logic.js");

const base = { situation:"new", type:"clinic", depts:[], inpatient:0,
  surgery:"none", radiology:"none", narcotics:false, regen:false, building:"new", floors:1, region:"" };

test("deriveActiveTags: 의원 기본은 always만", () => {
  const t = L.deriveActiveTags(base);
  assert.ok(t.has("always"));
  assert.ok(!t.has("입원실"));
  assert.ok(!t.has("수술실"));
});

test("deriveActiveTags: 입원실·전신마취·CT·마약류·재생·기존건물·3층", () => {
  const t = L.deriveActiveTags({ ...base, inpatient:10, surgery:"general", radiology:"ct",
    narcotics:true, regen:true, building:"existing", floors:3 });
  for (const tag of ["입원실","수술실","방사선","방사선:ct","마약류","재생의료","리모델링","다층"])
    assert.ok(t.has(tag), "missing " + tag);
});

test("deriveActiveTags: 과목·기관유형 매핑", () => {
  const t = L.deriveActiveTags({ ...base, type:"hospital", depts:["nephro","psych","gi"] });
  assert.ok(t.has("병원급"));
  assert.ok(t.has("과목:신장"));
  assert.ok(t.has("과목:정신"));
  assert.ok(t.has("과목:소화기"));
});

test("deriveActiveTags: 치과 유형 → 과목:치과, 방사선:치과", () => {
  const t = L.deriveActiveTags({ ...base, type:"dental", radiology:"dental" });
  assert.ok(t.has("과목:치과"));
  assert.ok(t.has("방사선:치과"));
});
