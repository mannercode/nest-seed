import type mongoose from 'mongoose'
import { getConnectionToken } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from '#config'
import type { AppTestContext } from './helpers/index.js'

describe('Health', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined

    beforeEach(async () => {
        teardown = undefined
        const { createAppTestContext } = await import('./helpers/index.js')
        fix = await createAppTestContext()
        teardown = fix.teardown
    })

    afterEach(() => teardown?.())

    describe('GET /health', () => {
        it('mongo·redis·nats·restate가 정상이면 200과 상태 정보를 반환한다', async () => {
            const { body } = await fix.httpClient.get('/health').ok()

            const allUp = {
                mongodb: { status: 'up' },
                redis: { status: 'up' },
                nats: { status: 'up' },
                restate: { status: 'up' }
            }
            expect(body).toEqual({ status: 'ok', info: allUp, error: {}, details: allUp })
        })

        it('핵심 의존성 하나라도 비정상이면 503과 실패 정보를 반환한다', async () => {
            const mongoConnection = fix.module.get<mongoose.Connection>(
                getConnectionToken(MONGO_CONNECTION_NAME)
            )
            const database = mongoConnection.db as NonNullable<mongoose.Connection['db']>
            jest.spyOn(database, 'command').mockRejectedValueOnce(new Error('mongo down'))

            const { body } = await fix.httpClient.get('/health').send(503)
            const info = {
                redis: { status: 'up' },
                nats: { status: 'up' },
                restate: { status: 'up' }
            }
            const error = { mongodb: { reason: 'Error: mongo down', status: 'down' } }

            expect(body).toEqual({ status: 'error', info, error, details: { ...info, ...error } })
        })
    })
})
