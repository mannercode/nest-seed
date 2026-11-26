import { MessageConsumer } from '#infrastructure'
import { MongoConnection, RestateEndpoint } from '@mannercode/common'
import { NestFactory } from '@nestjs/core'
import { MongoNotConnectedError } from 'mongodb'
import { once } from 'node:events'
import { createConnection } from 'node:net'
import { hostname } from 'node:os'
import { z } from 'zod'
import { AppConfigService } from '#config'
import { bootstrap } from '#api/bootstrap'
import {
    type AppTestContext,
    createAppTestContext,
    testConfig,
    testDeploymentUri,
    unregisterRestateDeployment
} from '#test-helpers'

describe('Health', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
    })

    afterEach(() => teardown?.())

    describe('GET /health', () => {
        describe('MongoDB·Redis·NATS·Restate 연결이 정상이면', () => {
            it('200을 반환한다', async () => {
                const { body } = await fix.httpClient.get('/health').ok()

                const allUp = {
                    mongodb: { status: 'up' },
                    redis: { status: 'up' },
                    nats: { status: 'up' },
                    restate: { status: 'up' }
                }
                expect(body).toEqual({ status: 'ok', info: allUp, error: {}, details: allUp })
            })
        })

        describe('연결은 살아 있고 JetStream 소비자가 종료됐으면', () => {
            beforeEach(async () => {
                await fix.module.get(MessageConsumer).onModuleDestroy()
            })
            it('503과 NATS 소비 중단 사유를 반환한다', async () => {
                const { body } = await fix.httpClient.get('/health').send(503)
                expect(body.error).toEqual({
                    nats: { status: 'down', reason: 'JetStream message consumer is stopped' }
                })
            })
        })
        describe('MongoDB 상태 확인에 실패하면', () => {
            beforeEach(() => {
                const mongo = fix.module.get(MongoConnection)
                vi.spyOn(mongo.db, 'command').mockRejectedValueOnce(new Error('mongo down'))
            })

            it('503과 MongoDB 실패 정보를 반환한다', async () => {
                const { body } = await fix.httpClient.get('/health').send(503)
                const info = {
                    redis: { status: 'up' },
                    nats: { status: 'up' },
                    restate: { status: 'up' }
                }
                const error = { mongodb: { reason: 'Error: mongo down', status: 'down' } }

                expect(body).toEqual({
                    status: 'error',
                    info,
                    error,
                    details: { ...info, ...error }
                })
            })
        })
    })
})

describe('API 시작', () => {
    beforeEach(() => {
        vi.spyOn(AppConfigService.prototype, 'http', 'get').mockReturnValue({
            ...testConfig().http,
            port: 0
        })
    })
    describe('배포 진입점으로 API를 시작하면', () => {
        let deployment: URL | undefined
        let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined
        const observeCreate = () => vi.spyOn(NestFactory, 'create')
        let created: ReturnType<typeof observeCreate>
        beforeEach(() => {
            created = observeCreate()
            vi.spyOn(AppConfigService.prototype, 'restateDeployment', 'get').mockReturnValue({
                ...testConfig().restateDeployment,
                uri: testDeploymentUri(0)
            })
            const register = RestateEndpoint.prototype.register
            vi.spyOn(RestateEndpoint.prototype, 'register').mockImplementationOnce(async function (
                this: RestateEndpoint,
                admin,
                uri
            ) {
                // 테스트가 요청한 0번 포트를 이 리스너에 실제 배정된 포트로 바꾼다.
                const target = new URL(uri)
                if (target.port === '0') target.port = String(this.port)
                deployment = await register.call(this, admin, target.href)
                return deployment
            })
        })
        afterEach(async () => {
            try {
                if (deployment) await unregisterRestateDeployment(deployment)
            } finally {
                await app?.close()
            }
        })
        it('Restate에 배포를 등록하고 상태 확인 요청에 200과 복제본 ID를 반환한다', async () => {
            await import('#api/main')
            app = await created.mock.results[0]!.value
            const registered = await fetch(deployment!)
            expect(registered.status).toBe(200)
            const { uri } = z.object({ uri: z.url() }).parse(await registered.json())
            expect(new URL(uri).href).toBe(
                new URL(testDeploymentUri(app!.get(RestateEndpoint).port)).href
            )
            const response = await fetch(new URL('/health', await app!.getUrl()))
            expect(response.status).toBe(200)
            expect(response.headers.get('x-replica-id')).toBe(hostname())
            expect(await response.json()).toMatchObject({ status: 'ok' })
        })
    })
    describe('HTTP 본문 크기 설정이 유효하지 않으면', () => {
        beforeEach(() => {
            vi.spyOn(AppConfigService.prototype, 'http', 'get').mockReturnValue({
                port: 0,
                requestPayloadLimit: 'invalid'
            })
        })
        it('이미 열린 MongoDB 연결을 닫고 설정 오류를 던진다', async () => {
            const created = vi.spyOn(NestFactory, 'create')
            const starting = bootstrap()
            const app = await created.mock.results[0]!.value
            try {
                await expect(starting).rejects.toThrow(/limit/)
                await expect(app.get(MongoConnection).ping()).rejects.toThrow(
                    MongoNotConnectedError
                )
            } finally {
                await app.close()
            }
        })
    })
    describe('개발 진입점에서 Restate가 배포 등록을 거부하면', () => {
        const failure = new Error('Registration rejected')
        let listenerPort: number
        beforeEach(() => {
            vi.stubEnv('NODE_ENV', 'test')
            vi.spyOn(RestateEndpoint.prototype, 'register').mockImplementationOnce(async function (
                this: RestateEndpoint
            ) {
                listenerPort = this.port
                throw failure
            })
        })
        it('열린 리스너를 닫고 시작 오류를 전달한다', async () => {
            await expect(import('#api/development')).rejects.toThrow('Registration rejected')
            expect(process.env.NODE_ENV).toBe('development')
            expect(listenerPort).toBeGreaterThan(0)
            const connection = createConnection(listenerPort, '127.0.0.1')
            try {
                await expect(once(connection, 'connect')).rejects.toMatchObject({
                    code: 'ECONNREFUSED'
                })
            } finally {
                connection.destroy()
            }
        })
    })
})
