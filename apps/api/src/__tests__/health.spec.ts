import { MessageConsumer } from '#infrastructure'
import { MongoConnection, RestateEndpoint } from '@mannercode/common'
import { NestFactory } from '@nestjs/core'
import { hostname } from 'node:os'
import { AppConfigService } from '#config'
import { testConfig } from './helpers/resources.js'
import {
    type AppTestContext,
    createAppTestContext,
    testDeploymentUri,
    unregisterRestateDeployment
} from './helpers/index.js'

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
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/health')
            })
            it('상태를 조회하면 200과 상태 정보를 반환한다', async () => {
                const { body } = await request.ok()

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
            it('상태를 조회하면 503과 NATS의 소비 중단 사유를 반환한다', async () => {
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

            it('상태 확인을 요청하면 503과 MongoDB의 실패 정보를 반환한다', async () => {
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
    describe('Restate가 배포를 등록할 수 있으면', () => {
        let deployment: URL | undefined
        let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined
        const observeCreate = () => vi.spyOn(NestFactory, 'create')
        let created: ReturnType<typeof observeCreate>
        beforeEach(() => {
            created = observeCreate()
            const register = RestateEndpoint.prototype.register
            vi.spyOn(RestateEndpoint.prototype, 'register').mockImplementationOnce(async function (
                this: RestateEndpoint,
                admin,
                uri
            ) {
                deployment = await register.call(this, admin, testDeploymentUri(uri, this.port))
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
        it('배포 진입점을 실행하면 복제본 ID와 함께 상태 확인 요청에 200을 반환한다', async () => {
            await import('../main.js')
            app = await created.mock.results[0]!.value
            const response = await fetch(new URL('/health', await app!.getUrl()))
            expect(response.status).toBe(200)
            expect(response.headers.get('x-replica-id')).toBe(hostname())
            expect(await response.json()).toMatchObject({ status: 'ok' })
        })
    })
    describe('Restate가 배포 등록을 거부하면', () => {
        const failure = new Error('Registration rejected')
        const observeShutdown = () => vi.spyOn(RestateEndpoint.prototype, 'onApplicationShutdown')
        let shutdown: ReturnType<typeof observeShutdown>
        beforeEach(() => {
            vi.stubEnv('NODE_ENV', 'test')
            vi.spyOn(RestateEndpoint.prototype, 'register').mockRejectedValueOnce(failure)
            shutdown = observeShutdown()
        })
        it('개발 진입점을 실행하면 열린 리스너를 닫고 시작 오류를 전달한다', async () => {
            await expect(import('../development.js')).rejects.toThrow('Registration rejected')
            expect(process.env.NODE_ENV).toBe('development')
            expect(shutdown).toHaveBeenCalledOnce()
        })
    })
})
