import { MongoHealthIndicator } from '../index.js'
import { MongoConnection } from '../../mongodb/index.js'
import type { MongoClient, Db } from 'mongodb'
import {
    type RedisHealthIndicatorFixture,
    createRedisHealthIndicatorFixture
} from './redis.health-indicator.fixture.js'

describe('RedisHealthIndicator', () => {
    let fix: RedisHealthIndicatorFixture

    beforeEach(async () => {
        fix = await createRedisHealthIndicatorFixture()
    })
    afterEach(() => fix.teardown())

    describe('isHealthy', () => {
        it('ping이 성공하면 up 상태를 반환한다', async () => {
            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { status: 'up' } })
        })

        it('ping이 Error 객체를 던지면 메시지와 함께 down 상태를 반환한다', async () => {
            vi.spyOn(fix.redis, 'ping').mockRejectedValueOnce(new Error('error'))

            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
        })

        it('ping이 Error 객체가 아닌 값을 던지면 원시 값을 reason으로 반환한다', async () => {
            vi.spyOn(fix.redis, 'ping').mockRejectedValueOnce('unknown error')

            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { reason: 'unknown error', status: 'down' } })
        })

        it('message가 없는 객체를 던지면 String(value)를 reason에 기록한다', async () => {
            vi.spyOn(fix.redis, 'ping').mockRejectedValueOnce({ code: 'X' })

            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { reason: '[object Object]', status: 'down' } })
        })
    })
})

describe('MongoHealthIndicator', () => {
    it('ping 성공 시 up을 반환한다', async () => {
        const connection = new MongoConnection(
            {} as MongoClient,
            { command: vi.fn().mockResolvedValue({ ok: 1 }) } as unknown as Db
        )
        expect(await new MongoHealthIndicator().isHealthy('mongo', connection)).toEqual({
            mongo: { status: 'up' }
        })
    })
    it('ping 실패 원인을 down 상태에 담는다', async () => {
        const connection = new MongoConnection(
            {} as MongoClient,
            { command: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as Db
        )
        expect(await new MongoHealthIndicator().isHealthy('mongo', connection)).toEqual({
            mongo: { status: 'down', reason: 'Error: offline' }
        })
    })
})
