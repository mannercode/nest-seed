import { defineConfig } from 'vitest/config'

// defineConfig()는 필수 런타임 함수라기보다 설정 객체에 자동완성과 타입 검사를
// 제공하는 도우미다. 이 파일은 `vitest run`을 실행할 때 자동으로 읽힌다.
export default defineConfig({
    test: {
        // 브라우저 DOM이 아니라 실제 Node.js 환경에서 Nest 애플리케이션을 실행한다.
        environment: 'node',

        // 각 테스트 파일에서 describe, it, expect, beforeEach, vi 등을 import하지 않고 쓴다.
        // tsconfig의 "vitest/globals"는 이 전역 함수들의 TypeScript 타입을 제공한다.
        globals: true,

        // 테스트 파일마다 전역 객체와 모듈 실행 환경을 격리한다. 한 파일이 변경한
        // globalThis나 모듈 상태가 다른 테스트 파일로 새는 것을 막는 기본 안전장치다.
        isolate: true,

        // 테스트 worker를 worker_threads가 아닌 Node 자식 프로세스로 실행한다.
        // process.env와 ESM 모듈 캐시의 경계를 프로세스 단위로 이해하기 쉬운 설정이다.
        pool: 'forks',

        sequence: {
            // 일반 it()들을 선언 순서대로 실행한다. 병렬 실행이 필요한 테스트만
            // it.concurrent() 또는 describe.concurrent()로 명시할 수 있다.
            concurrent: false,

            // 같은 단계의 beforeEach/afterEach 같은 hook을 등록한 순서대로 실행한다.
            hooks: 'list',

            // setupFiles가 여러 개일 경우 배열에 적힌 순서대로 실행한다.
            setupFiles: 'list'
        },

        // 각 테스트 파일을 import하기 전에 실행된다. 여기서 namespace를 정해야
        // message-patterns.ts의 모듈 최상위 코드가 올바른 값을 읽을 수 있다.
        setupFiles: ['./src/__tests__/setup.ts'],

        // 테스트 하나가 10초 넘게 끝나지 않으면 실패시킨다. NATS 연결 실패가
        // 무한 대기처럼 보이지 않도록 기본값을 명시했다.
        testTimeout: 10_000
    }
})
