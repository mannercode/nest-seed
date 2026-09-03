import { randomUUID } from 'node:crypto'

// setupFiles는 각 테스트 파일을 import하기 전에 실행된다. 따라서 테스트 파일이 정적으로
// import하는 message-patterns.ts보다 먼저 namespace를 준비할 수 있다.

// ??=는 외부에서 MESSAGE_NAMESPACE를 지정한 경우 그 값을 존중하고, 없을 때만 만든다.
// UUID는 동시에 실행 중인 서로 다른 test run을, VITEST_POOL_ID는 한 run 안의 worker를
// 구분한다. 결과적으로 병렬 실행된 테스트들이 같은 NATS subject를 공유하지 않는다.
process.env.MESSAGE_NAMESPACE ??= `demo-r${randomUUID().replaceAll('-', '')}-w${process.env.VITEST_POOL_ID ?? '0'}`
