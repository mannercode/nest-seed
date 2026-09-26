# API — 보류 항목

발견 근거는 `6bbe8cdf7df05ce9aa69cd6ab116f8ccde3fb7f0` 기준이다. 아래 항목은 보류하며, [선정 기준과 재검토 조건](README.md)을 따른다.

## API-4 — 보류 / 확신 높음: 스키마가 허용한 상영 시간이 실행 중 RangeError로 끝날 수 있다

**발생 조건**: `durationInMinutes=1/7`처럼 millisecond 단위 정수로 표현되지 않는 양수 분 값을 제출한다.

**근거**:

- [apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts](../../apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts) 5행는 `z.number().positive()`만 검사한다.
- [apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts](../../apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts) 86행과 `showtime-bulk-creator.service.ts:66`은 그 값을 DateUtil.add에 전달한다.
- common [libs/common/src/utils/date.ts](../../libs/common/src/utils/date.ts) 29행는 분을 milliseconds로 환산하여 `Temporal.Instant.fromEpochMilliseconds`에 전달한다. 이 API는 정수 milliseconds를 요구한다.
- [apps/api/src/services/application/showtime-creation/worker/workflow.ts](../../apps/api/src/services/application/showtime-creation/worker/workflow.ts) 77행의 실행 step은 이 RangeError를 업무 입력 거절로 분류하지 않는다. 재시도 정책 후 `:94`에서 시스템 `error` 상태로 끝난다.

**실제 재현**: 실제 BulkCreateShowtimesSchema.parse는 0.14285714285714285를 허용했고, 실제 DateUtil.add는 `RangeError: Temporal error: Expected finite integer.`를 던졌다. Restate 재시도 횟수까지 실제 실행하지는 않았고 그 이후 상태는 읽은 workflow 제어 흐름에 따른 결론이다.

**영향**: 계산 불가능한 입력을 접수해 DB 접수 기록·workflow를 만든 뒤 불필요한 시스템 오류 재시도를 수행한다. 0.5분 같은 표현 가능한 소수까지 모두 잘못됐다고 주장하지 않는다.

**재검토 조건**: 예제에서 지원할 시간 단위를 정할 때 스키마와 계산 범위를 맞춘다. 모든 분수 시간을 지원할 필요는 없으며, 분을 무조건 정수로 제한할지도 별도 API 계약 결정이다. DateUtil의 정밀도를 임의 반올림해 통과시키지 않는다. 현재 필수 작업에는 포함하지 않는다.

## 읽기 비용을 줄일 수 있는 작은 정리

1. **Booking의 세 내부 검색 DTO 클래스**: `booking-search-showdates.dto.ts:1`, `booking-search-showtimes.dto.ts:1`, `booking-search-theaters.dto.ts:3`은 각각 2~3개의 필드만 가진 class이고 실제 소비자는 BookingService 한 파일뿐이다. HTTP에서는 개별 route/query pipe가 이미 값을 만들고 class를 instantiate하거나 decorator metadata로 사용하지 않는다. 서비스의 인자를 이해하려고 세 파일과 barrel을 추가로 열게 된다. 객체 type을 기본으로 한다는 conventions와도 거리가 있다. 이 세 가지를 가까운 내부 타입 파일 또는 서비스 옆 타입 선언으로 모으는 정도는 선택 가능하다. 전체 DTO의 일괄 이동·class 금지는 필요 없다.
2. **한 필드 결과 클래스 두 개**: `showtimes/dtos/create-showtimes.result.ts:1`, `tickets/dtos/create-tickets.result.ts:1`은 `count:number`뿐이고 각각 자기 서비스 반환형에서만 사용한다. 실행 코드도 직접 `{count: createDtos.length}`를 반환한다. 이름 있는 독립 계약이 필요한 이유가 현재 코드에 없으므로 해당 메서드의 작은 반환 타입으로 표현하면 탐색 비용을 줄일 수 있다. 두 도메인을 연결하는 범용 Result 계층을 만들 이유는 없다.

barrel·DTO 경로의 개수 자체가 과설계의 증거는 아니다. 공개 진입점·런타임 스키마·도메인 모델을 분리한 가치가 있고, 위처럼 한 곳에서만 쓰며 별도 역할이 없는 작은 타입부터 판단한다.
