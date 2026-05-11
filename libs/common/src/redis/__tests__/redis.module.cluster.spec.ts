jest.mock('ioredis', () => {
    const actual = jest.requireActual('ioredis')
    return { ...actual, Cluster: jest.fn() }
})

describe('RedisModule', () => {
    describe('forRoot (cluster)', () => {
        // 이 테스트는 mock만 사용하며 실제 cluster 라우팅을 검증하지 않습니다.
        // 실제 cluster 동작은 jwt-auth 통합 테스트에서 검증됩니다.
        it('cluster 옵션을 주면 Cluster 인스턴스를 생성한다', async () => {
            const { Cluster } = await import('ioredis')
            const mockCluster = { ping: jest.fn().mockResolvedValue('PONG') }
            ;(Cluster as unknown as jest.Mock).mockReturnValue(mockCluster)

            const { createRedisModuleClusterFixture } = await import('./redis.module.fixture')
            const fix = await createRedisModuleClusterFixture()

            expect(Cluster).toHaveBeenCalledWith([{ host: 'localhost', port: 7000 }], undefined)

            await fix.teardown()
        })
    })
})
