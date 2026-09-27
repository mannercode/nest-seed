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

        describe('Redis ping이 Error 객체로 실패하도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(fix.redis, 'ping').mockRejectedValueOnce(new Error('error'))
            })
            it('상태 조회 시 오류 메시지와 down 상태를 반환한다', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
            })
        })

        describe('Redis ping이 문자열로 실패하도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(fix.redis, 'ping').mockRejectedValueOnce('unknown error')
            })
            it('상태 조회 시 그 문자열을 reason에 담아 down 상태를 반환한다', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { reason: 'unknown error', status: 'down' } })
            })
        })

        describe('Redis ping이 message 없는 객체로 실패하도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(fix.redis, 'ping').mockRejectedValueOnce({ code: 'X' })
            })
            it('상태 조회 시 객체를 문자열로 변환해 reason에 담는다', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { reason: '[object Object]', status: 'down' } })
            })
        })
    })
})

describe('MongoHealthIndicator', () => {
    describe('MongoDB ping이 성공하도록 설정하면', () => {
        let connection: MongoConnection
        beforeEach(() => {
            connection = new MongoConnection(
                {} as MongoClient,
                { command: vi.fn().mockResolvedValue({ ok: 1 }) } as unknown as Db
            )
        })
        it('상태 조회 시 up을 반환한다', async () => {
            expect(await new MongoHealthIndicator().isHealthy('mongo', connection)).toEqual({
                mongo: { status: 'up' }
            })
        })
    })
    describe('MongoDB ping이 실패하도록 설정하면', () => {
        let connection: MongoConnection
        beforeEach(() => {
            connection = new MongoConnection(
                {} as MongoClient,
                { command: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as Db
            )
        })
        it('상태 조회 시 실패 원인과 down 상태를 반환한다', async () => {
            expect(await new MongoHealthIndicator().isHealthy('mongo', connection)).toEqual({
                mongo: { status: 'down', reason: 'Error: offline' }
            })
        })
    })
})
