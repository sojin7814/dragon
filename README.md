# 드래곤 휴무

개인이 자기 휴무와 양도·교환·대바를 기록하는 앱입니다. 회사 공식 서비스가 아닙니다. 로그인 없이 현재 기기에 저장하며, 기존 수입장부와 AION2 앱은 건드리지 않습니다.

2026-09-20 수정본은 하우스 A/B/C/D와 고정 근무반 3종, 조회 전용 비교 달력, 날짜별 휴무 계획, 상단 테마 전환과 하단 안내 문구를 지원합니다. 기존 기록을 초기화하지 않습니다. [추가 수정·호환·검증 보고서](REVISION_REPORT.md)를 확인하세요.

정식 저장소는 [sojin7814/dragon](https://github.com/sojin7814/dragon), 승인된 앱 주소는 [드래곤 휴무](https://sojin7814.github.io/dragon/)입니다. 기본 경로는 `/dragon/`입니다. 사용자 제공 원본을 최종 설치 아이콘으로 사용합니다. 실제 배포 상태는 `IMPLEMENTATION_REPORT.md`에 기록합니다.

## 내 PC에서 열기

Node.js 24(최소 22.13)와 pnpm을 준비하세요. pnpm이 없다면 Node.js 설치 후 터미널에서 `npm install -g pnpm`을 한 번 실행합니다. 이미 pnpm이 있으면 건너뛰세요.

이 `dragon-calendar` 폴더에서 터미널을 열고 순서대로 입력합니다.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

터미널에 표시된 `http://127.0.0.1:5173/dragon/` 주소를 브라우저로 여세요. 종료는 터미널에서 `Ctrl+C`입니다. HTML 파일을 더블클릭해서 실행하지 마세요. 이 주소는 내 PC 전용이며 동료에게 보내는 공개 주소가 아닙니다.

개발 실행에서는 서비스워커를 사용하지 않습니다. 설치·오프라인·업데이트를 확인할 때는 아래의 빌드 미리보기를 사용하세요.

## 사용하는 순서

1. 하우스 A/B/C/D 또는 고정 근무반 카드의 범위·근무요일을 보고 내 근무 유형을 선택합니다.
2. 달력에서 날짜를 눌러 변경을 기록합니다. 양도는 실제로 근무하는지 쉬는지도 직접 고릅니다.
3. 근무 유형을 바꿀 때는 설정에서 적용 시작일과 새 유형을 정합니다. ‘다른 근무조 보기’는 내 설정을 바꾸지 않는 비교 기능입니다.
4. 휴대폰을 바꾸거나 브라우저 데이터를 삭제하기 전에는 설정 맨 아래에서 백업합니다.

자세한 사용·설치 안내는 앱의 **설정 → 사용설명서**에 있습니다.

다가오는 휴무 카드를 누르면 날짜마다 휴무 계획을 남길 수 있습니다. 계획은 날짜 메모와 같은 기록으로 백업·복원되며 달력에도 표시됩니다.

기록은 현재 브라우저에만 저장됩니다. 자동 서버 백업은 없습니다. ‘쿠키 및 사이트 데이터’ 삭제·기기 초기화로 기록이 지워질 수 있습니다. 다른 기기·브라우저·홈 화면 앱에서 기록이 안 보이면 원래 환경에서 백업한 뒤 복원하세요. 단순한 이미지·파일 캐시 삭제와 사이트 데이터 삭제는 다릅니다.

Android에서는 설치가 준비되면 앱 상단과 설정에 **홈 화면에 설치** 버튼이 나타납니다. 버튼 → 브라우저 확인창 → 설치 순서입니다. 카카오톡에서는 주소를 복사해 Chrome 또는 Samsung Internet에서 여세요. 같은 Android 브라우저로 설치한 앱은 같은 주소의 저장 기록을 사용합니다.

외부 캘린더 내보내기는 제거했습니다. 내부 달력과 기록·백업은 유지합니다. 최신 변경과 실기기 검증 상태는 [설치 개선 보고서](INSTALLATION_REPORT.md)를 참고하세요.

달력 옆(모바일에서는 아래)의 음악 카드에서 제공된 3곡을 들을 수 있습니다. 재생 버튼을 눌러야 시작하며, 곡 제목을 누르면 노래를 고를 수 있습니다. 가사를 누르거나 진행바를 움직이면 해당 위치로 이동합니다. [음악 추가 방법과 검증 결과](MUSIC_REPORT.md)를 참고하세요.

## 확인·출력 명령

| 할 일 | 명령 |
|---|---|
| 자동 테스트 | `pnpm test` |
| 타입 검사 | `pnpm typecheck` |
| 배포 파일 만들기 | `pnpm build` |
| 만든 파일을 내 PC에서 보기 | `pnpm preview` |
| 브라우저 검증 | `pnpm test:e2e` |
| 아이콘 다시 만들기 | `pnpm icons` |
| QR 생성 코드 자체 점검 | `pnpm qr --self-test` |
| 승인된 공개 주소로 QR 만들기 | `pnpm qr` |

브라우저 검증용 Chromium이 없다고 나오면 `pnpm exec playwright install chromium` 후 다시 실행합니다. 미리보기는 터미널에 표시된 주소로 접속합니다. `pnpm build`는 파일만 만들며 인터넷에 공개하지 않습니다.

## 나중에 바꿀 곳

| 바꾸는 내용 | 파일 |
|---|---|
| A 첫 휴무 기준일, A/B/C/D 범위 설명 | `src/config.ts` |
| 앱 이름·설치 이름·기본 색 | `assets/app.json` |
| 아이콘 원본 | `assets/icon-original.png` 또는 별도 512px 이상 원본 |
| 정식 공개 주소·배포 경로 | `.env` (필요 시 `.env.local` / GitHub 저장소 변수로 재정의) |

기준일은 캡처에서 확인한 **2025-12-02, A 첫 휴무**입니다. 현재도 같은 순환임을 사용자가 2026-09-19에 확인했습니다. 양도의 현장 의미는 자동 추정하지 않고 실제 근무/휴무를 사용자가 선택합니다.

- [GitHub Pages 최초 배포 안내](docs/deploy.md)
- [QR·A4·카카오톡 안내 만들기](docs/qr.md)
- [아이콘 교체 안내](docs/icons.md)
- [실제 휴대폰 확인표](docs/device-checks.md)
- 구현·검증 상태: `IMPLEMENTATION_REPORT.md`

회사 규칙은 제공된 구현 문서에 근거합니다. 기술 동작은 [Apple 설치 안내](https://support.apple.com/guide/iphone/iphea86e5236/ios), [MDN 설치 지원 설명](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [GitHub Pages 게시 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)을 참고했습니다. 기기별 검증 상태는 별도로 기록합니다.
