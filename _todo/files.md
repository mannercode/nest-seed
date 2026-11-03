# 파일 관리

현재 영화 이미지의 업로드·확정·삭제와 정리는 [앱 가이드](../apps/README.md#데이터와-dto)를 따른다.

## 진행 대상

### F1. 사용자 등록 시 사진 첨부

필요한 이유: [seed 정리 계획](seed-scope.md)은 영화·관리자·console을 제거하고 사용자 등록에 사진 첨부를 남기는 안이다. 현재 HTTP 업로드·확정·삭제는 관리자용 영화 경로에 있다. [Asset 모델](../apps/api/src/services/infrastructure/assets/models/asset.ts)은 연결 대상만 저장하고 업로더·공개 범위는 저장하지 않으며, 조회 시 다운로드 URL을 생성한다.

구현 전 결정: 사진 필수 여부, 계정 생성 전후의 업로드 순서와 요청 권한, 사진 처리 실패 시 계정 상태와 재요청 방법을 정한다. 미확정 사진을 관리할 주체와 사진 조회·다운로드 범위도 결정한다. URL 발급 전 접근 확인과 이미 발급한 URL의 유효 기간은 구분한다.

최소 수정 범위: 기존 크기·MIME·체크섬과 파일 정리 계약을 출발점으로 사용자 사진을 연결한다. UserRegistration이 Users·Assets의 공개 기능을 조율하고, 사용자 모델·DTO와 업로드·확정·정리 호출자를 새 사용처에 맞춘다. `libs/common`의 S3 구현은 변경하지 않는다.

조회 책임: Users는 사진 ID만 반환하고 Assets를 호출하지 않는다. UserHomeView가 조회한 사용자 목록의 사진 ID를 모아 Assets에서 다운로드 정보를 받아 화면 DTO를 만든다. 일반 사용자 조회에는 다운로드 URL을 포함하지 않는다.

검증 위치: [assets.spec.ts](../apps/api/src/__tests__/infrastructure/assets.spec.ts), [users.spec.ts](../apps/api/src/__tests__/core/users.spec.ts), [home.spec.ts](../apps/api/src/__tests__/view/home.spec.ts), user-app의 기존 브라우저 테스트. 기존 영화 파일 테스트에서 새 사용처에도 적용할 검증을 옮겨 DB 상태와 실제 업로드·다운로드 결과, 요청자의 관리 범위와 실패 후 재요청·정리를 확인한다. Users 조회와 View의 사진 URL 조합도 구분해 검증한다. 새 테스트 파일이 필요하면 작성 전에 사용자 동의를 구한다.

## 서비스별 확장 보류

사용자 사진 외의 범용 파일 API·비공개 첨부·미디어 변환·파일 버전 관리는 요구한 사용처가 없으므로 이번 완료 조건에서 제외한다.
