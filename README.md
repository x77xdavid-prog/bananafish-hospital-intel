# 바나나피쉬 병원 인텔리전스 (Hospital Intelligence)

건강보험심사평가원(HIRA) 공공데이터 기반으로 병의원 개원 후보지를 사전진단하는 정적 웹앱. 전국 병의원의 입지·경쟁 현황을 지도와 디렉터리로 보여주고, 후보지 진단·서류 1차 검토·후보지 비교 기능을 제공합니다.

## 주요 기능

- **위치 지도 · 디렉터리**: NAVER 지도 위에 전국 병의원을 마커·클러스터로 표시하고, 시도·종별·개원시기 필터와 검색·정렬을 지원 (`index.html`, `assets/app.js`)
- **후보지 사전진단 리포트**: 상황·기관유형·과목·입원실·수술·방사선 등을 입력하면 인허가 난이도와 맞춤 체크포인트를 산출 (`진단.html` / `내리포트.html`, `assets/diagnose-logic.js`, `assets/checklist-data.js`)
- **서류 자동 인식**: 업로드한 서류를 OCR 백엔드(`/api/extract`)로 보내 분석 (`서류분석.html`, `assets/doc-analyze.js`)
- **후보지 비교**: 동(읍·면·동) 중심 반경 내 동일 종별 경쟁도를 후보지 2~3곳 나란히 비교 (`비교.html`, `assets/compare.js`)
- **양수 매물 게시판**: 매물 카드에 반경 500m 동일 종별 경쟁도를 자동 표시 (`매물.html`, `assets/listings.js`)
- **리포트 예시 / 소개 페이지**: `리포트예시.html`, `소개.html`, `소개-glass.html`

## 기술 스택

- **프런트엔드**: 바닐라 HTML/CSS/JavaScript 정적 웹앱 (프레임워크·번들러 없음)
- **지도**: NAVER Maps Dynamic Map + 마커 클러스터링 헬퍼
- **데이터 빌드**: Python (`openpyxl`) — HIRA xlsx → `assets/data.js` 생성 (`build/build_data.py`)
- **테스트**: Node.js 내장 `node:test`

## 로컬 실행

정적 파일이므로 정적 서버로 띄우면 됩니다.

```bash
# 저장소 루트에서
python -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

데이터(`assets/data.js`)를 다시 생성하려면 HIRA 엑셀 원본을 `build/raw/`에 두고:

```bash
pip install openpyxl
python build/build_data.py
```

자세한 분기별 데이터 갱신 절차는 [`UPDATE.md`](UPDATE.md) 참고.

### 테스트

```bash
node --test tests/
```

## 배포

GitHub Pages: <https://x77xdavid-prog.github.io/bananafish-hospital-intel/>

## 데이터 출처

병원 위치·기본정보 데이터 © 건강보험심사평가원 — 전국 병의원 및 약국 현황 (공공누리 출처표시 제1유형 · 영리·가공 허용)

## 라이선스

[MIT](LICENSE)
