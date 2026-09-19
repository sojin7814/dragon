import { APP_NAME } from './config';

function InstallPicture({ step }: { step: 1 | 2 | 3 }) {
  return <svg viewBox="0 0 180 128" aria-hidden="true" focusable="false" style={{ width: 150, maxWidth: '100%', color: 'var(--accent, #3b6f58)' }}>
    <rect x="26" y="6" width="128" height="116" rx="15" fill="none" stroke="currentColor" strokeWidth="3" />
    <rect x="69" y="13" width="42" height="5" rx="2.5" fill="currentColor" />
    {step === 1 ? <>
      <rect x="40" y="30" width="100" height="48" rx="5" fill="currentColor" opacity=".1" />
      <path d="M78 97v13h25V97M91 101V82m-7 7 7-7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="91" cy="96" r="24" fill="none" stroke="currentColor" strokeDasharray="3 3" />
    </> : step === 2 ? <>
      <path d="M42 41h96M42 54h70" stroke="currentColor" opacity=".25" strokeWidth="5" strokeLinecap="round" />
      <rect x="38" y="69" width="104" height="34" rx="6" fill="currentColor" opacity=".12" />
      <path d="M50 84h14m-7-7v14" stroke="currentColor" strokeWidth="3" />
      <text x="72" y="89" fontSize="11" fill="currentColor" fontFamily="sans-serif">홈 화면에 추가</text>
    </> : <>
      <rect x="100" y="26" width="40" height="25" rx="12" fill="currentColor" />
      <text x="120" y="43" fill="#fff" fontSize="12" textAnchor="middle" fontFamily="sans-serif">추가</text>
      <rect x="69" y="67" width="42" height="39" rx="11" fill="currentColor" opacity=".15" />
      <path d="m77 85 8 8 17-18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </>}
  </svg>;
}

function InstallHelp() {
  return <section className="stack" aria-label="기기별 설치 방법">
    <p>설치하면 홈 화면에서 바로 열 수 있어요. 설치하지 않고 브라우저에서 사용해도 돼요.</p>
    <h3>아이폰 · 아이패드</h3>
    <p>현재 브라우저의 공유 메뉴에 ‘홈 화면에 추가’가 있으면 이용하세요. 항목이 없다면 앱 주소를 복사해 Safari에서 여세요.</p>
    <ol className="stack" style={{ paddingLeft: 24 }}>
      <li><InstallPicture step={1} /><p><strong>공유 버튼을 누르세요.</strong><br />상자에서 위로 화살표가 나가는 모양이에요. 화면 배치에 따라 페이지 메뉴 안에 ‘공유’가 있어요.</p></li>
      <li><InstallPicture step={2} /><p><strong>홈 화면에 추가를 선택하세요.</strong><br />공유 목록을 아래로 내려보세요.</p></li>
      <li><InstallPicture step={3} /><p><strong>이름을 확인하고 추가를 누르세요.</strong><br />‘웹 앱으로 열기’가 보이면 켜세요. 홈 화면의 아이콘을 눌러 열어보세요.</p></li>
    </ol>
    <details><summary>‘홈 화면에 추가’가 안 보여요</summary><p>Safari인지 확인하고 공유 목록의 아래쪽까지 내려보세요. ‘동작 편집’에 ‘홈 화면에 추가’가 있으면 추가하세요. iOS 버전과 화면 배치에 따라 메뉴 위치가 달라요. 아이패드에서는 공유 버튼이 화면 위쪽에 있을 수 있어요.</p></details>
    <h3>갤럭시 · 안드로이드</h3>
    <p>앱에 ‘설치하기’ 버튼이 보이면 누르고 브라우저의 확인창을 따라가세요. 버튼이 없다면 Chrome 메뉴(⋮) 또는 삼성 인터넷 메뉴에서 ‘앱 설치’나 ‘홈 화면에 추가’를 찾아보세요. 이름과 제공 여부는 브라우저마다 달라요.</p>
    <h3>PC · Chrome / Edge</h3>
    <p>설치하기 버튼이나 주소 표시줄의 앱 설치 아이콘을 사용하세요. 설치 아이콘이 없다면 브라우저 메뉴의 앱 항목을 확인하세요. 앱 설치와 바탕화면 바로가기 만들기는 별도 단계일 수 있어요.</p>
    <h3>카카오톡에서 열었어요</h3>
    <p>설치가 안 보이면 카카오톡의 화면 메뉴에서 ‘다른 브라우저로 열기’가 있는지 확인하세요. 없으면 설정의 ‘앱 공유 / QR코드’에서 주소를 복사한 뒤 Safari·Chrome·삼성 인터넷 주소창에 붙여넣으세요.</p>
    <p className="notice">가능하면 설치한 뒤 본격적으로 기록해주세요. 브라우저와 홈 화면 앱이 같은 기록을 공유한다고 보장할 수 없어요. 이미 입력했다면 원래 환경에서 백업한 뒤 새 환경에서 복원하세요.</p>
    <h3>인터넷이 안 되는 곳에서도</h3>
    <p>처음에는 인터넷에 연결해 앱을 열고 준비가 끝날 때까지 기다려주세요. 준비 후에는 달력·변경 기록·조 이동·테마·백업 파일 생성을 오프라인으로 사용할 수 있어요. 첫 방문 전에 인터넷이 끊겼다면 다시 연결해 앱을 여세요.</p>
    <p>새 버전이 준비되면 안내에 따라 입력을 저장하고 적용하세요. 다른 창에서 작성 중이면 그 창도 저장해주세요.</p>
  </section>;
}

function CalendarHelp() {
  return <section className="stack" aria-label="내 캘린더에 추가하는 방법">
    <p>달력 아래 <strong>이번 달 일정을 내 캘린더에 추가</strong>를 누르세요. 오늘이 속한 달이 아니라 <strong>지금 보고 있는 달</strong>의 휴무와 변경 기록을 파일로 만들어요.</p>
    <ol className="stack">
      <li>화면에 나온 연도·월, 일정 수를 확인하세요. 상대방 이름과 메모도 파일에 포함돼요.</li>
      <li>‘파일 저장’으로 <code>.ics</code> 일정 파일을 저장하세요. 지원 환경에서는 ‘파일 공유’도 사용할 수 있어요.</li>
      <li>기기의 캘린더에서 파일을 가져오고, 실제 날짜와 일정 수를 확인하세요. 파일 저장만으로 등록이 끝난 것은 아니에요.</li>
    </ol>
    <p className="notice">현재 보이는 달의 일정을 복사합니다. 이후 변경사항은 자동 반영되지 않으며, 다시 추가하면 중복될 수 있습니다.</p>
    <h3>갤럭시 · 삼성 캘린더</h3>
    <p>‘내 파일’의 다운로드 폴더에서 저장한 .ics 파일을 누르세요. 캘린더 열기·가져오기 항목이 제공되면 화면을 따라 등록하세요. 삼성 캘린더 버전과 연결 앱에 따라 이 경로가 없을 수 있으며, 월 전체 가져오기는 실기기 확인이 필요해요.</p>
    <p>직접 가져오기가 안 되면 파일은 보관해주세요. 이미 Google 캘린더를 사용하는 분은 PC의 Google 캘린더 설정 → 가져오기 및 내보내기로 파일을 가져올 수 있어요. 휴대폰에 같은 계정의 캘린더가 표시되도록 한 경우에만 해당 일정이 보여요. 이 방법은 사용자가 선택하는 외부 서비스이며, 이 앱에서 계정을 연결하거나 파일을 전송하지 않아요.</p>
    <h3>아이폰 · 기본 캘린더</h3>
    <p>파일 저장 후 기본 캘린더로 바로 가져오기 항목이 보이면 사용하세요. 미리보기만 보이고 ‘추가’가 없다면 그 경로에서는 등록이 끝나지 않은 상태예요. Safari와 홈 화면 앱 모두 월 전체 가져오기는 실기기 미검증이에요.</p>
    <p>Apple은 Mail에서 .ics 파일을 가져오는 방법을 안내해요. 이미 사용하는 메일에서 자신에게 파일을 첨부해 보내고 iPhone의 Mail에서 첨부파일을 열어 확인할 수 있어요. 기기·버전에 따라 실제 가져오기 여부를 확인해야 해요. 메일을 이용하면 이름·메모가 포함된 파일을 선택한 메일 서비스에 전달하게 돼요. 이 앱이 자동으로 전송하지는 않아요.</p>
    <p>Mac이 있다면 캘린더 앱의 파일 → 가져오기로 .ics 파일을 열 수도 있어요. iPhone과 같은 iCloud 캘린더를 이미 사용 중인 경우에만 그 계정에서 확인하세요. 앱 자체에 로그인하거나 캘린더 구독 주소를 만드는 기능은 없어요.</p>
    <h3>다시 추가할 때</h3>
    <p>앱에서 일정 수정 후 파일을 다시 만들면 새 내용이 담겨요. 기존 캘린더 일정을 자동 수정하지 않으므로 중복을 확인해주세요. 관계없는 일정까지 삭제하지 마세요.</p>
  </section>;
}

export function Help({ section = 'usage' }: { section?: 'usage' | 'install' | 'calendar' }) {
  if (section === 'install') return <InstallHelp />;
  if (section === 'calendar') return <CalendarHelp />;
  return <div className="stack">
    <p>{APP_NAME}는 각자 사용하는 개인 휴무 기록장이에요. 회사의 공식 근무 확정·승인 시스템이 아니에요.</p>
    <details open><summary>내 근무 유형 고르기 · 바꾸기</summary>
      <p>하우스 A/B/C/D는 범위 설명을 보고 고르세요. 고정 근무반은 주중반(월~금), 주말반(금~일), 주말반(토~일) 중 근무요일을 확인해 선택하세요. 기존 A/B/C/D 설정은 그대로 하우스 A/B/C/D로 표시해요.</p>
      <p>설정에서 ‘근무 유형 변경’을 누르고 새 유형과 적용 시작일을 정하세요. 적용일부터 새 규칙을 따르고 과거 일정은 유지돼요. 기존 대바·양도·교환·메모·휴무 계획도 남아요. 변경 이력은 여러 번 저장하고 수정·취소할 수 있어요.</p>
    </details>
    <details><summary>달력 이동 · 휴무 계산</summary>
      <p>좌우 화살표로 달을 이동하세요. 가운데 연도·월을 눌러 먼 날짜도 바로 고를 수 있어요. 오늘은 테두리와 글자로 구분해요.</p>
      <p>하우스 A → B → C → D 순서로 이틀씩 쉬며 각 하우스 휴무조는 8일마다 반복돼요. 2025년 12월 2일이 하우스 A의 첫 휴무이며 2026년 9월 19일 현행 순환을 확인했어요. 고정 근무반은 선택한 요일에 근무하고 나머지 요일에 쉬어요. 공휴일 여부는 계산에 반영하지 않으며 기본 근무는 실제 배정 확정을 뜻하지 않아요.</p>
    </details>
    <details><summary>일정 · 메모 · 휴무 계획</summary>
      <p>날짜를 누르거나 ‘일정이나 메모 남기기’로 열고 기록 날짜를 바꿀 수 있어요. ‘메모만·휴무 양도·휴무 교환’ 중 선택하고 ‘그날 나는’에서 근무·휴무를 정하세요. 기존 대바 기록의 상대방과 메모는 계속 확인할 수 있어요.</p>
      <p>다가오는 휴무 카드를 누르면 날짜별로 휴무 계획을 적을 수 있어요. 날짜 메모와 같은 기록이라 달력·백업·캘린더 파일에도 함께 반영돼요. 달력의 긴 메모는 한 줄로 줄이며 날짜를 누르면 전체 내용을 볼 수 있어요. 실제 휴무는 녹색, 근무는 핑크색으로 표시해요.</p>
      <p>‘다른 근무조 보기’에서는 내 휴무가 항상 녹색으로 보이고 다른 유형을 여러 개 겹쳐 볼 수 있어요. 비교 선택은 내 설정과 기록을 바꾸지 않아요. 상단 달·해 버튼으로 화면 모드를 즉시 바꿀 수 있으며 설정의 ‘기기 설정’도 계속 사용할 수 있어요.</p>
      <p>교환은 두 날짜와 각 날짜의 실제 휴무·근무를 확인한 뒤 함께 저장해요. 다른 달과 교환할 수도 있어요. 상대방 휴대폰을 바꾸거나 승인 요청을 보내지는 않아요.</p>
      <p>직접 수정과 메모도 날짜를 눌러 기록하세요. 저장 전 확인 문장을 읽고 저장해주세요. 변경을 취소하면 해당 날짜의 기본 일정으로 돌아가며, 연결된 교환이면 두 날짜를 함께 확인해요. 하루를 바꾸어도 이후 휴무 순환은 밀리지 않아요.</p>
    </details>
    <details><summary>밝은 화면 · 어두운 화면</summary><p>설정의 화면 모드에서 밝게 또는 어둡게를 선택하세요. 다음에 열 때도 선택을 유지해요.</p></details>
    <details><summary>백업 · 복원 · 휴대폰 바꾸기</summary>
      <p>설정 맨 아래 데이터 관리에서 ‘백업 파일 저장’을 눌러 파일을 안전한 곳에 보관하세요. 새 휴대폰이나 브라우저에서는 같은 앱을 열고 ‘백업 파일 복원’으로 파일을 고른 뒤 내용을 확인하세요. 복원은 현재 기록을 바꾸므로 현재 기록도 먼저 백업해주세요.</p>
      <p className="notice">설정과 변경 기록은 현재 기기의 브라우저에 저장돼요. ‘쿠키 및 사이트 데이터’·‘사이트 저장공간’을 삭제하거나 브라우저·휴대폰을 초기화하면 지워질 수 있어요. 휴대폰을 바꾸거나 데이터를 삭제하기 전에 백업해주세요.</p>
      <p>‘캐시된 이미지·파일’ 삭제와 사이트 데이터 삭제는 달라요. 다른 기기·브라우저·주소·홈 화면 앱에서 기록이 안 보여도 원래 환경에는 남아 있을 수 있어요. 원래 사용하던 앱에서 확인하고 백업 → 복원으로 옮기세요.</p>
      <p>자동 서버 백업은 없어요. 시크릿·개인정보 보호 모드에서는 기록이 유지되지 않을 수 있어 일상 기록용으로 권하지 않아요. 백업 파일에는 이름과 메모가 들어가므로 공개 대화방에 올리지 마세요.</p>
    </details>
    <details><summary>휴대폰 캘린더에 추가하기</summary><CalendarHelp /></details>
    <details><summary>홈 화면 설치 · 카카오톡에서 열기</summary><InstallHelp /></details>
    <details><summary>앱 공유 · QR코드</summary><p>설정의 ‘앱 공유 / QR코드’에서 정식 주소를 복사·공유하거나 QR 이미지를 저장하세요. 같은 휴대폰에서 받은 링크는 눌러 열고, 종이나 PC에 보이는 QR은 카메라로 비추세요. 앱 주소만 공유되고 내 기록은 전달되지 않아요. QR은 자동 설치·백업·기록 이전 기능이 아니에요.</p></details>
  </div>;
}

export default Help;
