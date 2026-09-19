# GitHub Pages에 처음 올리기

사용자가 공개 저장소 **[sojin7814/dragon](https://github.com/sojin7814/dragon)**과 앱 주소 **[https://sojin7814.github.io/dragon/](https://sojin7814.github.io/dragon/)**를 승인했습니다. 로컬 빌드와 이 주소를 담은 QR 생성, GitHub 로그인은 완료했습니다. **소스 파일을 승인된 원격 저장소에 반영 중이며 공개 배포·접속 확인은 남아 있습니다.** 주소가 정해졌거나 일부 소스가 올라갔다는 사실만으로 앱의 공개 배포가 끝난 것은 아닙니다.

## 확정된 배포 설정

- 2025-12-02가 A 첫 휴무인 8일 순환은 2026-09-19 사용자 확인을 완료했습니다. 이후 회사 순환표가 바뀌면 기준일을 확인합니다.
- 기존 공개 저장소 `sojin7814/dragon`의 `main`을 사용합니다. 초기 README 커밋 이력을 유지합니다.
- 공개 주소는 `https://sojin7814.github.io/dragon/`, 하위 경로는 `/dragon/`입니다.
- 제공받은 아이콘 원본 `assets/icon-original.png`를 적용했습니다. 아이콘 교체 절차는 [아이콘 안내](icons.md)를 참고하세요.

## 승인된 저장소에 반영

이미 존재하는 `sojin7814/dragon` 저장소의 이력을 유지하면서 이 `dragon-calendar` 폴더의 파일을 저장소 최상위에 반영합니다. 새 저장소를 다시 만들거나 기존 이력을 강제로 덮어쓰지 않습니다. 상위 폴더의 구현 문서나 다른 프로젝트를 통째로 올리지 마세요. 테스트 기대 날짜는 코드에 포함되어 있지만 사용자 캘린더 캡처, 개인 백업, 실제 이름·메모, 비밀키는 업로드하지 않습니다. `.gitignore`가 보호하는 파일도 업로드 전 직접 확인합니다.

이 프로젝트의 `.github/workflows/deploy.yml`은 `main`에 반영되면 검사 후 자동 배포합니다. pull request에서는 검사만 합니다. 이 대상에 대한 사용자 승인과 GitHub 로그인은 완료됐으며, 현재 남은 단계는 파일 반영 완료와 배포 확인입니다. 이후 승인된 저장소의 `main` 변경도 같은 검사를 거쳐 자동 배포됩니다.

## GitHub 화면에서 설정

1. `sojin7814/dragon` 저장소 → **Settings → Pages**로 갑니다.
2. **Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
3. **Settings → Secrets and variables → Actions → Variables**에서 아래 값을 명시할 수 있습니다. 현재 workflow에는 승인된 주소가 기본값으로 들어 있어 변수가 없어도 같은 주소를 사용합니다.

| 변수 | 값 |
|---|---|
| `PUBLIC_URL` | `https://sojin7814.github.io/dragon/` |
| `BASE_PATH` | `/dragon/`. 생략해도 `dragon` 저장소 이름에서 자동 계산합니다. |

앱 주소는 `https://sojin7814.github.io/dragon/`이고, 코드 저장소 주소는 `https://github.com/sojin7814/dragon`입니다. QR에는 앱 주소를 사용합니다. 배포 완료 후 Pages가 제공하는 주소와 실제 앱 접속을 확인해야 합니다.

GitHub Actions는 Node.js 24와 pnpm으로 잠금 파일에 맞춰 설치하고, 자동 테스트·QR 자체 점검·타입 검사·빌드를 거칩니다. `dist/`만 Pages에 올립니다. Pages 사이트는 공개적으로 접근 가능한 웹사이트이므로 개인 기록 파일은 절대로 포함하지 마세요. [GitHub의 게시 소스 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 첫 배포 확인

승인된 `main`에 반영한 뒤 **Actions**에서 완료 여부를 확인합니다. 로컬 수정이나 로컬 빌드만으로 배포가 완료되는 것은 아닙니다.

1. Pages가 제공한 주소를 열고 설정의 앱 버전을 확인합니다.
2. 저장소 하위 경로에서 새로고침, 아이콘, 홈 화면 실행, 달력과 기록 저장을 확인합니다.
3. 앱의 공유 주소가 실제 Pages 주소와 정확히 같은지 확인합니다. 다르면 `PUBLIC_URL`을 고친 뒤 다시 반영합니다.
4. 생성된 QR과 안내문의 주소가 같은지 확인합니다. 현재 로컬 `.env`와 QR은 승인된 주소로 맞췄습니다. 재생성이 필요하면 [QR 생성 안내](qr.md)를 따릅니다.
5. [실기기 확인표](device-checks.md)로 아이폰·갤럭시·PC를 확인합니다. 테스트하지 않은 환경은 미검증으로 남깁니다.

## 로컬에서 배포 경로 미리 확인

현재 로컬 `.env`는 `BASE_PATH=/dragon/`, `VITE_PUBLIC_URL=https://sojin7814.github.io/dragon/`로 설정되어 있습니다. 다른 PC에서 설정 파일이 없다면 `.env.example`을 복사해 `.env.local`을 만들고 같은 값을 넣습니다. 그다음 실행합니다.

```powershell
pnpm build
pnpm preview
```

미리보기 주소 뒤에 `/dragon/`을 붙여 접속합니다. localhost는 개발·미리보기용이므로 운영 QR에는 사용하지 않습니다. GitHub Actions는 저장소 변수와 workflow 기본값을 사용합니다. `.env.local`은 Git에 올리지 않습니다.

## 이후 자동 업데이트

변경사항이 `main`에 반영되고 배포 검사가 통과하면 새 정적 파일이 공개됩니다. 각 기기는 온라인에서 새 버전을 받아 준비합니다. 작성 중에는 적용을 미루고 저장·취소한 뒤 안내에 따라 적용합니다. 여러 창을 열어둔 경우 다른 창에서도 저장하거나 닫아주세요. 숨겨진 창이 응답하지 않아도 입력을 버리고 강제 적용하지 않습니다.

앱의 캐시와 개인 기록은 별개입니다. 업데이트 때문에 기록을 지우거나 저장 키를 바꾸지 않습니다. 다른 앱의 캐시나 서비스워커도 지우지 않습니다. 모든 기기가 같은 순간 바로 바뀌는 것은 아니며, 외부 캘린더로 이미 복사한 일정은 앱 업데이트로 변경되지 않습니다.
