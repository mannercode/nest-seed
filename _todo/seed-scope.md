# 영화 등록 예제를 남기는 seed 정리

검토 기준은 `25374215`이며 시작 시 미커밋 변경은 없었다. 극장 예매는 복사한 `playground`에서 다룬다. 이 저장소에는 도메인과 SoLA 구조를 보여 주는 영화 정보 등록·목록·이미지 업로드, 이벤트·비동기 작업 예제를 남긴다. 이번 작업에서 `libs/`의 소스·테스트·설정·의존성·문서는 변경하지 않는다.

## 앱 서비스 구성안

- `UsersService`: 회원 가입·인증·계정 관리.
- `MoviesService`: 영화 정보의 저장·조회와 영화 자체의 규칙.
- `AssetsService`: 파일 업로드 요청·완료 확인·소유 연결·다운로드·삭제·만료 정리.
- `MovieRegistrationService`: 영화 정보 저장과 업로드 파일의 확정·연결을 조율할 Application 예제.
- `HealthService`: 앱과 실제 사용하는 인프라의 상태 확인.
- `EventDemoService`: 이벤트 발행·수신과 저장·ack·재전달 예제.
- `JobDemoService`: 비동기 작업 접수·상태 조회·결과·중단 후 재개 예제.

이 목록은 기능 단위다. 인증 내부 처리·로그인 제한·입력 검증·설정·로깅·연결 관리는 필요한 만큼 유지한다. Users·Movies는 Core, Assets는 Infrastructure, Health는 기존 앱 모듈에 둔다. MovieRegistration·EventDemo·JobDemo는 Application에 두고 HTTP 진입점은 Gateway에 둔다. SDK 연결·호출은 기존 common의 공개 기능을 사용한다.

MovieRegistration은 새 서비스의 제안이다. 단순 생성·조회 호출을 전달하기만 하는 계층은 만들지 않는다. 현재 Movies가 맡는 파일 조율을 옮길 때는 책임을 중복하지 않고, 업로드·확정·연결의 실패와 재요청 계약을 먼저 정한다. EventDemo·JobDemo는 독립 예제로 유지하며 같은 Application 계층의 서비스끼리 직접 호출하지 않는다.

## 진행 대상

### D1. 관리자·극장 예매 전용 API 제거

- [ ] Core의 `admins`, `theaters`, `showtimes`, `tickets`, `ticket-holding`, `purchase-records`, `watch-records`를 제거한다.
- [ ] Application의 `booking`, `movie-deletion`, `theater-deletion`, `purchase`, `showtime-creation`, `recommendation`을 정리한다.
- [ ] 예제 결제인 `infrastructure/payments`와 영화·상영을 조합하는 `view/user-app/home`을 정리한다.
- [ ] 관리자 전용 Guard·인증 설정·계정 생성 스크립트와 개발 인프라 초기화 호출을 제거한다.

대응 컨트롤러·공개 export·앱 등록·DTO·테스트·fixture·curl 문서를 같은 기능 단위로 정리한다. `TICKET_*` 설정과 전용 날짜·멱등성 입력 처리도 실제 사용처에 맞춘다. Movies·Assets는 유지하되 상영·추천·관리자 기능에 대한 의존을 제거한다.

### D2. Event·Job Demo 구성

- [ ] `EventDemoService`에서 입력한 메시지를 발행하고 수신 결과를 확인할 수 있게 한다.
- [ ] `JobDemoService`에서 작은 입력을 접수하고 작업 ID로 상태와 결과를 확인할 수 있게 한다.

Event Demo는 Core NATS의 실시간 전달과 JetStream의 저장·ack·재전달을 구분해서 보여 준다. PubAck와 소비자의 처리 완료도 구분한다. 실제 메일·문자 발송 기능은 추가하지 않는다.

Job Demo는 Restate의 작업 실행과 중단 후 재개를 보여 준다. 구매 보상·좌석 선점·상영 충돌 같은 업무 규칙을 옮기지 않고, 실행을 길게 보이게 하는 임의의 sleep이나 재시도를 추가하지 않는다. 입력·결과·재요청 의미를 정한 뒤 구현한다.

### D3. user-app에서 영화와 파일 사용 흐름 제공

- [ ] `apps/console`과 해당 실행·포트·빌드·브라우저 테스트 구성을 제거한다.
- [ ] user-app에 영화 정보 등록·이미지 업로드·목록 조회를 제공한다.
- [ ] 영화 등록의 Application 예제를 구성하고 기존 상영·추천 응답 의존을 제거한다.

사용자 가입·로그인·로그아웃·본인 조회와 기존 쿠키 인증, user-app BFF의 갱신·오류 처리 계약을 유지한다. 영화 등록 권한과 작성자별 관리 범위는 구현 전에 정한다. 영화 목록만 반환하는 조회에는 별도 View 서비스를 추가하지 않는다.

### D4. 실행·검증·문서 갱신

- [ ] API 테스트 context와 자원 정리에서 구매 workflow·JetStream subject에 고정된 처리를 Demo에 맞춘다.
- [ ] API 문서·브라우저 테스트·Race·benchmark·CI에서 삭제한 API를 호출하는 경로를 정리한다.
- [ ] 루트와 영역별 README를 새 앱 구성과 실행 명령에 맞춘다.

현재 Race의 SSE·좌석 선점·상영 겹침·구매 검사는 제거할 API에 의존한다. 가입·refresh 경쟁과 복제본 종료 검사는 남길 계정 기능에도 적용할 수 있다. 극장 CRUD를 측정하는 benchmark는 그대로 유지할 수 없으며, 영화 CRUD로 바꿀지 별도로 판단한다.

NATS·Restate 연결과 health는 새 Demo에서도 실제 사용한다. common의 S3·NATS·Restate SDK는 현재 필수 peer dependency이므로 앱의 직접 호출을 지웠다는 이유만으로 의존성 선언이나 라이브러리 검증용 이미지 설정을 삭제하지 않는다.

## 구현 전 남은 결정

- **영화와 파일 등록:** 파일 업로드는 영화 이미지로 유지한다. 현재 영화 쓰기 API는 관리자 전용이며 Movie에는 작성자 필드가 없다. 사용자 등록 권한·수정과 삭제 범위, draft/publish 유지 여부, 등록 과정의 요청·응답과 실패 후 재요청 계약을 정한다. 파일 세부 사항은 [파일 TODO](files.md)를 따른다.
- **회원 정보:** 이름·생년월일의 유지 여부는 계정 모델의 선택이다. 도메인 제거만으로 가입·수정·응답 계약을 자동 변경하지 않으며, [사용자 TODO](users.md)와 함께 맞춘다.
- **Demo 계약:** 이벤트 payload·관찰 방법, 작업의 입력·결과·재요청 의미, HTTP 경로·접근 권한을 작은 계약으로 확정한다.
- **Demo 화면:** Event·Job은 우선 API와 실행 가능한 curl 문서로 제공하는 안을 추천한다. user-app의 기본 화면 범위는 인증·영화 등록·이미지 업로드·목록 조회다.

## 검증

삭제한 도메인·관리자·console의 참조와 사용하지 않는 설정이 남지 않았는지 확인하고 `libs/`의 diff가 없는지 검사한다. 남긴 계정·영화·파일 기능과 Demo의 실제 요청·응답 및 저장·메시지·재개 결과를 검증한다. 루트의 `pnpm run lint`, `pnpm run test`, `pnpm run atoz`와 변경한 Race를 실행한다. 테스트와 커버리지 기준은 유지한다.

검토한 범위는 앱 모듈 조립·설정·health, 예매·추천·이벤트·workflow의 호출 관계, 두 데모의 요청 경로, 테스트 준비·정리와 실행 구성이다. 라이브러리 구현 변경이나 전체 저장소의 결함 리뷰는 포함하지 않는다.
