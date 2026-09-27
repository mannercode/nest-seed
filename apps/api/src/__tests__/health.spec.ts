import { MongoConnection } from '@mannercode/common'
import { type AppTestContext, createAppTestContext } from './helpers/index.js'

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

        describe('MongoDB 상태 확인에 실패하면', () => {
            beforeEach(() => {
                const mongo = fix.module.get(MongoConnection)
                vi.spyOn(mongo.db, 'command').mockRejectedValueOnce(new Error('mongo down'))
            })

            it('503과 MongoDB의 실패 정보를 반환한다', async () => {
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
