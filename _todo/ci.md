# CI 러너 복귀

## 보류: MongoDB 수정판 배포 대기

- 이유: `ubuntu-24.04-arm`의 Linux 7.0 커널에서는 MongoDB 8.0.32가 시작을 거부한다. Ubuntu 커널 판별 수정은 [SERVER-131779](https://jira.mongodb.org/browse/SERVER-131779)의 8.0.35에 예정되어 있지만 아직 공식 이미지가 배포되지 않았다.
- 최소 변경: 수정판이 배포되면 `.env.infra`의 MongoDB 태그와 digest를 검증해 갱신하고, 테스트 워크플로 세 곳을 `ubuntu-24.04-arm`으로 복귀시킨다. 테스트 가이드의 러너 설명도 갱신한다.
- 검증: 새 러너에서 MongoDB Replica Set 초기화, AtoZ, Stability와 API Race를 실행한다. MongoDB의 호스트 커널 검사를 우회하지 않는다.
- 기한: `ubuntu-22.04-arm`은 [2027년 3월 일시 중단, 4월 17일 지원 종료](https://github.com/actions/runner-images/issues/14254)가 예정되어 있으므로 3월 이전에 처리한다. 수정판 배포 전에는 현재 CI 복구의 완료 조건에서 제외한다.
