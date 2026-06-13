/* 양수 매물 게시판 — 운영자 관리 데이터(승인된 매물만 여기에 게시).
   ⚠ 신규 매물은 '매물 내놓기' 폼 접수 → 운영자 검수 후 이 배열에 추가한다.
   필드:
     id      고유 id
     sido/gu/emd  지역(emd가 data.js와 일치하면 반경 경쟁도 자동 표시)
     cl      종별(data.js cl 값: 의원/치과의원/한의원/병원 등) — 경쟁도 집계 기준
     dept    진료과목(표시용)
     area    전용 평수(숫자)
     years   개원 연차(숫자)
     premium 권리금 구간(문자열·구간으로만, 정확 금액 지양)
     rent    임대 조건(선택)
     reason  양도 사유
     desc    한 줄 설명
     posted  게시일(YYYY-MM-DD)
     sample  true면 '예시' 배지(데모용 — 실매물 등록 시 제거)
   연락처는 저장/노출하지 않는다(문의는 운영자 경유). */
window.HII_LISTINGS = [
  {
    id: "L-MAGOK-1", kind: "매매", sido: "서울", gu: "강서구", emd: "마곡동",
    cl: "병원", dept: "의료시설(병원) 단독 건물",
    price: "250억 원",
    grossArea: "2,338.35㎡ (약 707평)",
    landArea: "1,586㎡ (약 480평)",
    buildArea: "670.8㎡",
    zoning: "제3종일반주거지역",
    usage: "의료시설(병원) · 일부 1·2종근생(휴게음식점·사무소)",
    scale: "주건축물 지상3층 / 부건축물 지상4층",
    structure: "일반철골조 / 경량철골조",
    facilities: "엘리베이터 4기 등",
    parking: "23대(외부 자주식)",
    approval: "2011.4.6 / 2018.3.20",
    note: "남서향(주출입구 기준) · 화장실 층별",
    desc: "마곡 의료시설 단독 건물 통매각 — 병원 용도 사용승인 완료.",
    posted: "2026-06-13"
  },
  {
    id: "L-SAMPLE-1", kind: "양수", sido: "서울", gu: "강남구", emd: "역삼동",
    cl: "의원", dept: "내과", area: 58, years: 7,
    premium: "8천만~1.2억", rent: "보증금 5,000 / 월 350",
    reason: "원장 이전 개원", desc: "역세권 1층, 내시경실 구비, 단골 환자 기반 양호.",
    posted: "2026-06-10", sample: true
  },
  {
    id: "L-SAMPLE-2", sido: "경기", gu: "성남분당구", emd: "정자동",
    cl: "치과의원", dept: "치과", area: 32, years: 5,
    premium: "5천만~8천만", rent: "보증금 3,000 / 월 220",
    reason: "은퇴", desc: "유니트 4대, 인테리어 4년차 양호, 상가 2층.",
    posted: "2026-06-08", sample: true
  },
  {
    id: "L-SAMPLE-3", sido: "부산", gu: "부산진구", emd: "부전동",
    cl: "한의원", dept: "한방", area: 25, years: 10,
    premium: "3천만~5천만", rent: "보증금 2,000 / 월 150",
    reason: "건강 사유", desc: "탕전실 구비, 충성 환자층, 대로변 접근성 우수.",
    posted: "2026-06-05", sample: true
  }
];
