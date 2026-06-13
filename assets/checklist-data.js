/* 마스터 인허가 체크리스트 — 진단 개인화·전체 PDF 공용 원본.
   각 항목이 노출되는 조건 = tags (활성 태그와 교집합이 있으면 적용). 'always'는 항상 적용.
   reject:true = 반려·지연 다발 → 결과 화면 Top3 우선. */
(function (global) {
  var CHECKLIST = [
    // A. 작도 착수 전 사전 확인
    { id: "A1", cat: "사전확인", text: "건축물대장상 해당 층 용도 확인 (1종 근생-의원 / 의료시설-병원)", tags: ["always"], reject: true },
    { id: "A2", cat: "사전확인", text: "용도변경 필요 여부 및 변경도면 제출 범위 확정", tags: ["리모델링"], reject: true },
    { id: "A3", cat: "사전확인", text: "관할 보건소·소방서·구청 사전협의 완료 및 적용 기준 확정", tags: ["always"], reject: false },
    { id: "A4", cat: "사전확인", text: "정화조 용량 산정(의료시설 오수 기준) 및 증설 필요 여부", tags: ["always"], reject: false },
    { id: "A5", cat: "사전확인", text: "부설주차장 대수 재산정(용도변경 시 추가 의무) 및 장애인전용주차", tags: ["리모델링"], reject: false },
    { id: "A6", cat: "사전확인", text: "바닥 구조하중 검토(CT·MRI 등 대형 장비 도입 시) — 건축 구조도면 확인", tags: ["중장비"], reject: false },
    { id: "A7", cat: "사전확인", text: "지하층 의료기관 개설 가능 여부 — 채광·환기·피난 기준 사전 확인(개설 제한 가능)", tags: ["지하"], reject: true },

    // B. 평면·실 구획
    { id: "B1", cat: "평면구획", text: "진료실·처치실·수술실 등 천장까지 벽체 완전구획(커튼·파티션 불가)", tags: ["always"], reject: true },
    { id: "B2", cat: "평면구획", text: "각 실 명칭·바닥면적 표기(실명표/면적표)", tags: ["always"], reject: false },
    { id: "B3", cat: "평면구획", text: "오염·청결 구역 및 환자 동선 분리 표기", tags: ["always"], reject: false },
    { id: "B4", cat: "평면구획", text: "외래환자 진료 시 소독시설(소독실) 구획", tags: ["always"], reject: false },

    // C. 수술실·회복실
    { id: "C1", cat: "수술실", text: "수술실 상호 간 칸막이벽 구획, 수술실당 수술대 1개", tags: ["수술실"], reject: false },
    { id: "C2", cat: "수술실", text: "공기정화설비(헤파필터 등) 및 공조 계통 반영", tags: ["수술실"], reject: false },
    { id: "C3", cat: "수술실", text: "내부 불침투질 마감, 바닥 접지, 콘센트 바닥면 1m 이상 높이", tags: ["수술실"], reject: false },
    { id: "C4", cat: "수술실", text: "수술용 의료가스·멸균·배수 등 부대시설", tags: ["수술실"], reject: false },
    { id: "C5", cat: "수술실", text: "회복실 별도 구획(수술실 설치 시 필수)", tags: ["수술실"], reject: false },
    { id: "C6", cat: "수술실", text: "수술실 CCTV·영상저장 공간(전신마취 등 의무, 계획된 진정 포함·영상 30일 이상 보관)", tags: ["수술실"], reject: true },

    // D. 방사선실
    { id: "D1", cat: "방사선", text: "방사선 차폐벽 위치·두께·납당량(납판 매수) 명시", tags: ["방사선"], reject: true },
    { id: "D2", cat: "방사선", text: "방사선 관계종사자 방어벽 및 조정실 위치", tags: ["방사선"], reject: false },
    { id: "D3", cat: "방사선", text: "출입문 차폐 및 경고표지·인터록 위치", tags: ["방사선"], reject: false },
    { id: "D4", cat: "영상장비(MRI)", text: "MRI 자기장 안전구역(5가우스 라인) 설정·출입통제 및 강자성체 반입 차단", tags: ["mri"], reject: true },
    { id: "D5", cat: "영상장비(MRI)", text: "MRI RF 차폐실(쉴드룸)·비자성 구조재 적용 및 자기장 누설 검토", tags: ["mri"], reject: false },
    { id: "D6", cat: "영상장비(MRI)", text: "MRI 냉각(칠러)·켄치(quench) 배기관 외부 배출 경로 및 응급차단", tags: ["mri"], reject: false },

    // E. 감염·폐기물·소독
    { id: "E1", cat: "감염폐기물", text: "지정폐기물(의료폐기물) 보관실 독립 구획(싱크대 권장)", tags: ["always"], reject: false },
    { id: "E2", cat: "감염폐기물", text: "기구 소독 동선과 오염 기구 세척 동선 분리", tags: ["always"], reject: false },

    // F. 입원실
    { id: "F1", cat: "입원실", text: "입원실 1실당 병상 수 기준(다인실 상한) — 신·증축 기준 확인", tags: ["입원실"], reject: false },
    { id: "F2", cat: "입원실", text: "병상 간 이격거리 1.5m 이상(특례 적용 시 1m 이상)", tags: ["입원실"], reject: false },
    { id: "F3", cat: "입원실", text: "입원실 내 손씻기 시설 및 환기시설(시간당 2회 이상)", tags: ["입원실"], reject: false },
    { id: "F4", cat: "입원실", text: "입원실 면적 표기(1인실 10㎡ / 다인실 1인당 6.3㎡)", tags: ["입원실"], reject: false },

    // G. 첨단재생의료
    { id: "G1", cat: "재생의료", text: "인체세포 등 보관실(냉동·냉장 + 온도 모니터링)", tags: ["재생의료"], reject: false },
    { id: "G2", cat: "재생의료", text: "기록보관실", tags: ["재생의료"], reject: false },
    { id: "G3", cat: "재생의료", text: "혈액검사 등 검사실", tags: ["재생의료"], reject: false },
    { id: "G4", cat: "재생의료", text: "처치실(수술실·회복실·소독시설 등)", tags: ["재생의료"], reject: false },
    { id: "G5", cat: "재생의료", text: "무균조작 공간(클린벤치 등) 및 공조 반영", tags: ["재생의료"], reject: false },
    { id: "G6", cat: "재생의료", text: "6개 시설 천장까지 완전구획 + 각 시설 독립 출입동선", tags: ["재생의료"], reject: true },
    { id: "G7", cat: "재생의료", text: "평면도 실 명칭이 시설·장비 목록과 정확히 일치(지정심사 제출용)", tags: ["재생의료"], reject: false },

    // H. 소방·피난
    { id: "H1", cat: "소방피난", text: "스프링클러(또는 간이) 설치 — 입원실 有 시 면적 무관 전 층 의무", tags: ["입원실"], reject: true },
    { id: "H2", cat: "소방피난", text: "자동화재탐지·비상경보/방송·유도등·휴대용 비상조명등", tags: ["always"], reject: false },
    { id: "H3", cat: "소방피난", text: "복도 유효너비: 양옆 거실 1.5m / 한쪽 거실 1.2m 이상", tags: ["always"], reject: true },
    { id: "H4", cat: "소방피난", text: "방화구획 및 방화문 위치(피난계단 연결부) 표기", tags: ["always"], reject: false },
    { id: "H5", cat: "소방피난", text: "인테리어 마감재 방염 성적서 대상 자재 표기", tags: ["always"], reject: false },
    { id: "H6", cat: "소방피난", text: "비상구·피난유도등·완강기 등 피난기구 위치 및 호실별 피난방향", tags: ["always"], reject: false },
    { id: "H7", cat: "소방피난", text: "제연설비 대상 여부(특별피난계단 부속실·무창층 등) 확인", tags: ["always"], reject: false },
    { id: "H8", cat: "소방피난", text: "직통계단 2개소·보행 피난거리 30m 이하·무창층 비상탈출구·환기통(건축법 시행령 제34조)", tags: ["다층", "입원실", "지하"], reject: true },
    { id: "H9", cat: "소방피난", text: "지하층 제연설비·비상조명·피난 동선 강화 및 비상탈출구 확보", tags: ["지하"], reject: false },

    // I. 장애인 편의시설
    { id: "I1", cat: "장애인편의", text: "주출입구 턱 제거, 단차 시 경사로(구배 1:12 이하) 공간", tags: ["always"], reject: true },
    { id: "I2", cat: "장애인편의", text: "환자 출입 모든 실 출입문 유효폭 0.9m 이상(문틀 제외 순개방폭)", tags: ["always"], reject: true },
    { id: "I3", cat: "장애인편의", text: "장애인 화장실: 회전반경 1.4m 이상, 안전손잡이, 장애인용 변기", tags: ["always"], reject: false },
    { id: "I4", cat: "장애인편의", text: "승강기(2층 이상) 및 장애인 전용 주차구역·접근로", tags: ["다층"], reject: false },
    { id: "I5", cat: "장애인편의", text: "주출입구 점자블록·유도 및 안내설비", tags: ["always"], reject: false },

    // J. 전기·기계·위생
    { id: "J1", cat: "전기기계위생", text: "수전용량 증설 및 의료기기 전용회로(CT·MRI 등 도입 시)", tags: ["중장비"], reject: false },
    { id: "J2", cat: "전기기계위생", text: "비상전원(UPS·비상발전기) 회로 — 수술실·중환자실 등", tags: ["수술실"], reject: false },
    { id: "J3", cat: "전기기계위생", text: "의료가스(산소 등) 공급·저장설비 배관 및 안전표기", tags: ["수술실"], reject: false },
    { id: "J4", cat: "전기기계위생", text: "환기·공조 계통도 및 실내공기질 기준 검토", tags: ["always"], reject: false },
    { id: "J5", cat: "전기기계위생", text: "급배수 계통 및 오염·청결 동선 분리", tags: ["always"], reject: false },
    { id: "J6", cat: "전기기계위생", text: "전기 KEC 의료장소: 그룹2(수술실·중환자실) 의료용 절연변압기(IT계통)·등전위본딩·비상전원 절체", tags: ["수술실"], reject: true },
    { id: "J7", cat: "전기기계위생", text: "EMR 서버실/통신실 구획·항온항습·전용 소화설비", tags: ["always"], reject: false },

    // K. 도면 표기·제출
    { id: "K1", cat: "도면제출", text: "축척·방위·범례 표기 및 실명표·면적표 일치", tags: ["always"], reject: false },
    { id: "K2", cat: "도면제출", text: "마감재 방염·방사선 차폐·장비 배치 명기", tags: ["always"], reject: false },
    { id: "K3", cat: "도면제출", text: "인허가 제출용 부수·형식(보건소/소방/구청별) 확인", tags: ["always"], reject: false },

    // 진료과목 조건부
    { id: "M1", cat: "과목특수", text: "인공신장실(투석): 정수실·세척실·오물처리실·환자탈의실, 병상당 ≥6㎡, B형간염 격리투석 공간", tags: ["과목:신장"], reject: false },
    { id: "M2", cat: "과목특수", text: "정신과 폐쇄병동·격리실(보호실) 별도 구획, 자해·도주 방지 안전마감", tags: ["과목:정신"], reject: false },
    { id: "M3", cat: "과목특수", text: "분만실 독립 구획·신생아실 별도·모자동실·신생아 식별/보안", tags: ["과목:산부인"], reject: false },
    { id: "M4", cat: "과목특수", text: "내시경 세척·소독실 동선 분리 및 환기(ACH·환기시간)", tags: ["과목:소화기"], reject: false },
    { id: "M5", cat: "과목특수", text: "치과 구내촬영 차폐·경고표지(조정실 면제 가능)", tags: ["방사선:치과", "과목:치과"], reject: false },
    { id: "M6", cat: "과목특수", text: "한의원 탕전실(해당 한의과목 운영 시, 분리/공동사용 가능)", tags: ["과목:한방"], reject: false },
    { id: "M7", cat: "과목특수", text: "마약류 저장시설: 고정형 철제금고·이중잠금·CCTV·무인경비", tags: ["마약류"], reject: true },

    // 병원급 [별표3] 필수시설 / 감염
    { id: "N1", cat: "병원급", text: "임상검사실·방사선장치실·급식·세탁물처리·의무기록실(병원급 필수)", tags: ["병원급"], reject: false },
    { id: "N2", cat: "병원급", text: "중환자실 격리병실(병상 10개당 1) 및 음압격리병실(AII) 규격(1인실 ≥15㎡·ACH·차압모니터)", tags: ["입원실", "병원급"], reject: false },

    // 리모델링 전제
    { id: "R1", cat: "사전확인", text: "석면 사전조사(해체·리모델링 시) — 착공 전제조건", tags: ["리모델링"], reject: true },

    // L. 산출물 목록
    { id: "L1", cat: "산출물", text: "배치도 / 평면도(실 구획·동선·면적)", tags: ["always"], reject: false },
    { id: "L2", cat: "산출물", text: "천장도 / 마감재 표", tags: ["always"], reject: false },
    { id: "L3", cat: "산출물", text: "전기 설비도", tags: ["always"], reject: false },
    { id: "L4", cat: "산출물", text: "기계·공조·위생 설비도", tags: ["always"], reject: false },
    { id: "L5", cat: "산출물", text: "소방 설비도 / 피난 계획도", tags: ["always"], reject: false },
    { id: "L6", cat: "산출물", text: "방사선 차폐 상세도", tags: ["방사선"], reject: false },
    { id: "L7", cat: "산출물", text: "가구·의료장비 배치도", tags: ["always"], reject: false },
    { id: "L8", cat: "산출물", text: "첨단재생의료 시설·장비 배치도", tags: ["재생의료"], reject: false }
  ];

  if (typeof module !== "undefined" && module.exports) module.exports = { CHECKLIST: CHECKLIST };
  global.CHECKLIST = CHECKLIST;
})(typeof window !== "undefined" ? window : globalThis);
