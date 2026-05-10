// 코드베이스 무관 — 큰 npm 모듈만 require 하고 noop 테스트.
// spec1~spec4 가 동일 코드. testFile 사이의 RSS 점프가 jest/resetModules
// 자체에서 오는지 코드베이스 특정 누수인지 가설 검증.
require('reflect-metadata')
require('@nestjs/common')
require('@nestjs/core')
require('@nestjs/testing')
require('@nestjs/mongoose')
require('@nestjs/config')
require('mongoose')
require('@temporalio/worker')
require('@temporalio/client')
require('@aws-sdk/client-s3')
require('ioredis')
require('nats')

afterAll(() => {
    if (global.gc) {
        global.gc()
        global.gc()
    }
    const m = process.memoryUsage()
    const v8 = require('v8')
    const h = v8.getHeapStatistics()
    const mb = (n) => (n / 1024 / 1024).toFixed(0)
    process.stderr.write(
        `[probe] ${expect.getState().testPath?.split('/').pop()} rss=${mb(m.rss)} heap=${mb(m.heapUsed)} heapTotal=${mb(m.heapTotal)} ext=${mb(m.external)} arrBuf=${mb(m.arrayBuffers)} exec=${mb(h.total_heap_size_executable)} mallocedMem=${mb(h.malloced_memory)}\n`
    )
})

test('noop', () => {
    expect(1).toBe(1)
})
