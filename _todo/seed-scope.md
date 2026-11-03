# 사용자 등록 예제로 줄이는 seed 정리

검토 기준은 `25374215`이며 시작 시 미커밋 변경은 없었다. 영화·극장 예매는 복사한 `playground`에서 다룬다. 이 저장소는 사진을 첨부하는 사용자 등록·목록 조회로 도메인·Application·View의 역할을 보여 주고, 이벤트·비동기 작업은 독립 예제로 남기는 안으로 정리한다. 이번 작업에서 `libs/`의 소스·테스트·설정·의존성·문서는 변경하지 않는다.

## 앱 서비스 구성안

- `UsersService`: 회원 가입·인증·계정 관리.
- `WebHomeViewService`: 사용자 목록과 화면에서 표시할 사진 URL을 조합.
- `AssetsService`: 파일 업로드 요청·완료 확인·소유 연결·다운로드·삭제·만료 정리.
- `UserRegistrationService`: 사용자 등록과 사진의 확정·연결을 조율할 Application 예제.
- `HealthService`: 앱과 실제 사용하는 인프라의 상태 확인.
- `EventDemoService`: 이벤트 발행·수신과 저장·ack·재전달 예제.
- `JobDemoService`: 비동기 작업 접수·상태 조회·결과·중단 후 재개 예제.

이 목록은 기능 단위다. Users 내부의 `UserAuthenticationService`와 Gateway의 인증 Guard·로그인 제한, 입력 검증·설정·로깅·연결 관리는 유지한다. Users는 Core, Assets는 Infrastructure, Health는 기존 앱 모듈에 둔다. UserRegistration은 Application, WebHomeView는 View에 두고 HTTP 진입점은 Gateway에 둔다. SDK 연결·호출은 기존 common의 공개 기능을 사용한다.

UserRegistration은 Users·Assets의 공개 기능을 조합하는 새 서비스의 제안이다. 사용자 등록·파일 업로드·확정·연결의 순서와 실패 후 재요청 계약을 먼저 정한다. 단순 사용자 조회는 Gateway에서 Core를 직접 호출한다.

Users는 사용자 정보와 사진 ID만 반환하며 조회할 때 Assets를 호출하거나 다운로드 URL을 만들지 않는다. URL이 필요 없는 호출에 자산 조회·URL 발급 비용을 부과하지 않기 위해서다. WebHomeView가 Users의 목록 조회 결과에서 현재 페이지의 사진 ID를 모아 Assets의 공개 기능으로 조회하고 화면 DTO를 만든다. 중복 ID는 한 번만 요청하고 사용자별로 자산 조회를 반복하지 않는다. View는 사용자 등록·사진 연결 같은 상태 변경을 맡지 않는다.

현재 정의한 EventDemo·JobDemo는 도메인 서비스를 조합하지 않는다. EventDemo는 common의 NATS·JetStream 기능을, JobDemo는 common의 Restate 기능을 사용하는 외부 연동 예제이므로 Infrastructure에 두는 안이다. 비동기 실행이라는 이유만으로 Application에 두지 않는다. 같은 Infrastructure 계층의 서비스끼리 직접 참조하지 않으며, 도메인 서비스를 사용하는 업무 흐름이 생기면 그 조율을 Application에 둔다.

## 진행 대상

### D1. 관리자·극장 예매 전용 API 제거

- [ ] Core의 `admins`, `movies`, `theaters`, `showtimes`, `tickets`, `ticket-holding`, `purchase-records`, `watch-records`를 제거한다.
- [ ] Application의 `booking`, `movie-deletion`, `theater-deletion`, `purchase`, `showtime-creation`, `recommendation`을 정리한다.
- [ ] 예제 결제인 `infrastructure/payments`를 제거한다.
- [ ] `WebHomeViewService`의 영화·상영·극장·추천 의존과 응답을 사용자 목록·사진 응답으로 바꾼다.
- [ ] 관리자 전용 Guard·인증 설정·계정 생성 스크립트와 개발 인프라 초기화 호출을 제거한다.

대응 컨트롤러·공개 export·앱 등록·DTO·테스트·fixture·curl 문서를 같은 기능 단위로 정리한다. `TICKET_*` 설정과 전용 날짜·멱등성 입력 처리도 실제 사용처에 맞춘다. Assets는 유지하고 Movies가 맡던 파일 업로드·연결·정리 중 사용자 사진에도 필요한 동작을 새 사용처로 옮긴다.

### D2. Event·Job Demo 구성

- [ ] `EventDemoService`에서 입력한 메시지를 발행하고 수신 결과를 확인할 수 있게 한다.
- [ ] `JobDemoService`에서 작은 입력을 접수하고 작업 ID로 상태와 결과를 확인할 수 있게 한다.

Event Demo는 Core NATS의 실시간 전달과 JetStream의 저장·ack·재전달을 구분해서 보여 준다. PubAck와 소비자의 처리 완료도 구분한다. 실제 메일·문자 발송 기능은 추가하지 않는다.

Job Demo는 Restate의 작업 실행과 중단 후 재개를 보여 준다. 구매 보상·좌석 선점·상영 충돌 같은 업무 규칙을 옮기지 않고, 실행을 길게 보이게 하는 임의의 sleep이나 재시도를 추가하지 않는다. 입력·결과·재요청 의미를 정한 뒤 구현한다.

### D3. web에서 사진을 첨부하는 사용자 등록·조회 제공

- [ ] web에서 사용자 등록 시 사진을 첨부하고 홈에서 사용자 목록과 사진을 조회할 수 있게 한다.
- [ ] 사용자 등록의 Application 예제를 구성하고 기존 영화·상영·추천 응답 의존을 제거한다.

사용자 로그인·로그아웃과 기존 쿠키 인증, web BFF의 갱신·오류 처리 계약을 유지한다. 사진을 포함한 가입과 조회 권한은 구현 전에 정한다. Gateway는 홈 조회를 WebHomeView에, 사진을 포함한 등록을 UserRegistration에 맡긴다. web의 BFF는 인증 쿠키의 토큰을 API 요청 헤더에 넣고 요청을 전달하는 역할로 유지한다.

### D4. 실행·검증·문서 갱신

- [ ] API 테스트 context와 자원 정리에서 구매 workflow·JetStream subject에 고정된 처리를 Demo에 맞춘다.
- [ ] API 문서·브라우저 테스트·Race·benchmark·CI에서 삭제한 API를 호출하는 경로를 정리한다.
- [ ] 루트와 영역별 README를 새 앱 구성과 실행 명령에 맞춘다.

현재 Race의 SSE·좌석 선점·상영 겹침·구매 검사는 제거할 API에 의존한다. 가입·refresh 경쟁과 복제본 종료 검사는 남길 계정 기능에도 적용할 수 있다. 극장 CRUD를 측정하는 benchmark는 그대로 유지할 수 없으며, 사용자 CRUD로 바꿀지 별도로 판단한다.

NATS·Restate 연결과 health는 새 Demo에서도 실제 사용한다. common의 S3·NATS·Restate SDK는 현재 필수 peer dependency이므로 앱의 직접 호출을 지웠다는 이유만으로 의존성 선언이나 라이브러리 검증용 이미지 설정을 삭제하지 않는다.

## 구현 전 남은 결정

- **사용자와 사진 등록:** 현재 파일 API는 관리자용 영화 경로에 있고 Users에는 사진 연결이 없다. 사진 필수 여부, 가입 전후의 업로드 순서와 요청 권한, 사진 처리 실패 시 계정 상태와 재요청 계약을 정한다. 같은 화면에서 함께 입력한다는 요구만으로 계정·파일이 원자적으로 생성된다고 가정하지 않는다. 파일 세부 사항은 [파일 TODO](files.md)를 따른다.
- **사용자 조회:** 사용자 목록과 사진을 View에서 조합한다. 반환할 사용자 정보와 접근 범위는 정해야 한다. 현재 사용자 목록은 관리자 전용이므로 Guard만 제거해 공개하지 않는다.
- **회원 정보:** 이름·생년월일의 유지 여부는 계정 모델의 선택이다. 도메인 제거만으로 가입·수정·응답 계약을 자동 변경하지 않으며, [사용자 TODO](users.md)와 함께 맞춘다.
- **Demo 계약:** 이벤트 payload·관찰 방법, 작업의 입력·결과·재요청 의미, HTTP 경로·접근 권한을 작은 계약으로 확정한다.
- **Demo 화면:** Event·Job은 우선 API와 실행 가능한 curl 문서로 제공하는 안을 추천한다. web의 기본 화면 범위는 인증·사진을 첨부하는 사용자 등록·조회다.

## 보류

공유 패키지 가이드의 이전 웹앱 이름 표기는 `libs/` 전체를 변경하지 않는 조건 때문에 보류한다. 앱 코드·실행 설정에는 적용되지 않는 문서 표기이며, 라이브러리 문서 수정이 허용될 때 [해당 안내](../libs/README.md#2-sdk-연결과-호출은-common에서-구현한다)의 앱 이름을 맞춘다.

## 검증

삭제한 도메인·관리자의 참조와 사용하지 않는 설정이 남지 않았는지 확인하고 `libs/`의 diff가 없는지 검사한다. 남긴 계정·사진 기능과 Demo의 실제 요청·응답 및 저장·메시지·재개 결과를 검증한다. Users 조회가 Assets를 호출하지 않는지, View가 해당 페이지에 필요한 사진만 조회·조합하는지도 확인한다. 루트의 `pnpm run lint`, `pnpm run test`, `pnpm run atoz`와 변경한 Race를 실행한다. 테스트와 커버리지 기준은 유지한다.

변경 범위는 앱 모듈 조립·설정·health, 예매·추천·이벤트·workflow의 호출 관계, web의 요청 경로, 테스트 준비·정리와 실행 구성이다. 라이브러리 구현 변경이나 전체 저장소의 결함 리뷰는 포함하지 않는다.
