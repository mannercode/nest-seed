import { randomUUID } from 'node:crypto'

// setupFiles는 테스트 파일보다 먼저 실행된다. @MessagePattern은 이 값을 한 번만 읽는다.
process.env.MESSAGE_NAMESPACE ??= `demo-r${randomUUID().replaceAll('-', '')}-w${process.env.VITEST_POOL_ID ?? '0'}`
