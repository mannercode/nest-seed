# 프로젝트 리뷰에서 남은 항목

## 보류

- [CacheService.withLockBlocking](../libs/common/src/cache/cache.service.ts): `waitMs: 10`, `pollMs: 40`에서 첫 획득 실패 후 두 번째 획득이 성공하면 40ms 이후 콜백을 실행한다. 가짜 Redis 응답으로 재현했으며 실제 Redis 지연 실험은 아니다. 엄격한 deadline인지 polling 대기 예산인지 계약을 더 명확히 할 수 있으나, 현재 취소·상호배제 훼손은 확인하지 않아 우선 수정 완료 조건에서 제외한다.
- [구매 중복 ticketIds](../apps/api/src/services/application/purchase/internal/ticket-purchase.service.ts): 같은 티켓을 중복 요청하면 결제 후 판매 건수 불일치로 거절·보상될 수 있다. 현재 판매 정합성과 보상은 유지되며, 잘못된 입력의 조기 거절 정책은 새 요구가 생길 때 검토한다.
