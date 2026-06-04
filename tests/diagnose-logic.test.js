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

test("scoreCase: 의원 최소 = 1", () => {
  assert.strictEqual(L.scoreCase(base), 1);
});

test("scoreCase: 종합병원+입원실+CT+마약류+재생+기존+3층 = 3+1+1+1+1+1+1 = 9", () => {
  const s = L.scoreCase({ ...base, type:"general", inpatient:20, surgery:"general",
    radiology:"ct", narcotics:true, regen:true, building:"existing", floors:3 });
  assert.strictEqual(s, 9);
});

test("difficultyBand: 경계값", () => {
  assert.deepStrictEqual(L.difficultyBand(2), { stars:1, label:"수월" });
  assert.deepStrictEqual(L.difficultyBand(3), { stars:3, label:"주의" });
  assert.deepStrictEqual(L.difficultyBand(4), { stars:3, label:"주의" });
  assert.deepStrictEqual(L.difficultyBand(5), { stars:4, label:"까다로움" });
});
