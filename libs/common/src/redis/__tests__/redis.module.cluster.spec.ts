import type { Mock } from 'vitest'

vi.mock('ioredis', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>()
    return { ...actual, Cluster: vi.fn() }
})

describe('RedisModule', () => {
    describe('forRoot (cluster)', () => {
        // 이 테스트는 mock 구현만 사용하며 실제 클러스터 라우팅을 검증하지 않는다.
        // jwt-auth 통합 테스트는 단일 Redis로 해시 태그 키 배치 호환성만 검증한다.
        // 실제 클러스터 연결은 infra의 Redis 클러스터를 쓰는 api 앱에서 검증된다.
        it('클러스터 옵션을 주면 Cluster 인스턴스를 생성한다', async () => {
            const { Cluster } = await import('ioredis')
            // 모듈 destroy 시 RedisConnectionRegistry가 quit을 호출하므로 mock에도 포함한다.
            const mockCluster = {
                ping: vi.fn().mockResolvedValue('PONG'),
                quit: vi.fn().mockResolvedValue('OK')
            }
            type ClusterConstructor = new (...args: unknown[]) => typeof mockCluster
            ;(Cluster as unknown as Mock<ClusterConstructor>).mockImplementation(
                class {
                    readonly ping = mockCluster.ping
                    readonly quit = mockCluster.quit
                }
            )

            const { createRedisModuleClusterFixture } = await import('./redis.module.fixture.js')
            const fix = await createRedisModuleClusterFixture()
            try {
                expect(Cluster).toHaveBeenCalledWith([{ host: 'localhost', port: 7000 }], undefined)
            } finally {
                await fix.teardown()
            }
        })
    })
})
