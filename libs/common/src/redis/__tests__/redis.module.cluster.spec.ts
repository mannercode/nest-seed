jest.mock('ioredis', () => {
    const actual = jest.requireActual('ioredis')
    return { ...actual, Cluster: jest.fn() }
})

describe('RedisModule', () => {
    describe('forRoot with cluster', () => {
        // cluster 옵션으로 Cluster 인스턴스를 생성한다
        it('creates a Cluster instance', async () => {
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
