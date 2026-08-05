// v1 binary와 rolling overlap 중인 v2 Activity가 같은 임계 구역을 사용하기 위한 호환 fence다.
// original task queue의 실행이 완전히 drain된 것을 확인한 뒤 별도 릴리스에서 제거할 수 있다.
export const LEGACY_VALIDATE_CREATE_LOCK_KEY = 'validate-and-create'
export const LEGACY_VALIDATE_CREATE_LOCK_TTL_MS = 15 * 60 * 1000
export const LEGACY_VALIDATE_CREATE_LOCK_WAIT_MS = 10 * 60 * 1000
