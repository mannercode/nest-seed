# 파일 관리

현재 영화 이미지의 업로드·확정·삭제와 정리는 [앱 가이드](../apps/README.md#데이터와-dto)를 따른다.

## 서비스별 확장 보류

### F1. 파일 API의 새 사용처와 접근 정책

보류 이유: 현재 HTTP 업로드·확정·삭제는 관리자용 영화 경로에 있다. [Asset 모델](../apps/api/src/services/infrastructure/assets/models/asset.ts)은 연결 대상만 저장하고 업로더·공개 범위는 저장하지 않으며, 조회 시 다운로드 URL을 생성한다. 사용자 프로필·비공개 첨부 등을 위한 범용 파일 API는 실제 사용처가 정해지지 않았다.

재검토 조건: 새 사용처가 생기면 업로드 요청자와 연결 대상의 관계, 미확정 파일의 관리 권한, 단일 소유 유지 여부를 정한다. URL 발급 전 인가와 이미 발급한 URL의 유효 기간을 구분하고 [권한 정책](authorization.md)과 함께 요청자별 업로드·확정·조회·삭제 및 만료 후 다운로드를 검증한다. 저장소 연동은 `libs/common`, 파일 정책과 업무 대상 연결은 앱의 기존 SoLA 구조에서 담당한다.

검증 위치: [assets.spec.ts](../apps/api/src/__tests__/infrastructure/assets.spec.ts), [movies-assets.spec.ts](../apps/api/src/__tests__/core/movies-assets.spec.ts), [S3 테스트](../libs/common/src/s3/__tests__/s3-object.service.spec.ts). DB 상태와 실제 업로드·다운로드 결과를 함께 확인한다.
