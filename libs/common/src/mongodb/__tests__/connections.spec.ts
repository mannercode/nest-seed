import { MongoClient, type Db } from 'mongodb'
import { Test } from '@nestjs/testing'
import { Global, Module } from '@nestjs/common'
import { MongoConnection, MongoModule } from '../index.js'

describe('MongoConnection', () => {
    it('소유한 client는 모듈 종료 시 닫는다', async () => {
        const client = { close: vi.fn() } as unknown as MongoClient
        const connection = new MongoConnection(client, {} as Db)

        await connection.onModuleDestroy()

        expect(client.close).toHaveBeenCalledOnce()
    })

    it('공유 client는 AppContext가 종료되어도 닫지 않는다', async () => {
        const client = { close: vi.fn() } as unknown as MongoClient
        const connection = new MongoConnection(client, {} as Db, false)

        await connection.onModuleDestroy()

        expect(client.close).not.toHaveBeenCalled()
    })
})

describe('MongoModule', () => {
    it.each([undefined, 50])(
        '주입한 최소 풀 크기(%s)로 연결하고 소유한 client를 닫는다',
        async (minPoolSize) => {
            const options = {
                uri: process.env.TESTLIB_MONGO_URI!,
                dbName: process.env.TESTLIB_MONGO_DATABASE!,
                minPoolSize
            }
            const config = Symbol('config')
            @Global()
            @Module({ providers: [{ provide: config, useValue: options }], exports: [config] })
            class Configuration {}
            const module = await Test.createTestingModule({
                imports: [
                    Configuration,
                    MongoModule.forRootAsync({
                        inject: [config],
                        useFactory: async (value) => value
                    })
                ]
            }).compile()
            const connection = module.get(MongoConnection)
            const close = vi.spyOn(connection.client, 'close')
            try {
                await expect(connection.ping()).resolves.toBeUndefined()
                expect(connection.db.databaseName).toBe(options.dbName)
                expect(connection.client.options.minPoolSize).toBe(minPoolSize ?? 0)
                expect(connection.client.options.waitQueueTimeoutMS).toBe(5000)
                expect(connection.client.options.writeConcern).toMatchObject({
                    j: true,
                    w: 'majority',
                    wtimeoutMS: 60000
                })
            } finally {
                await module.close()
            }
            expect(close).toHaveBeenCalledOnce()
        }
    )
})

describe('MongoConnection.connect', () => {
    it.each([false, true])(
        '연결 실패 뒤 정리 실패 여부(%s)와 무관하게 원래 오류를 전달한다',
        async (cleanupFails) => {
            const failure = new Error('connect failed')
            vi.spyOn(MongoClient.prototype, 'connect').mockRejectedValueOnce(failure)
            const close = vi.spyOn(MongoClient.prototype, 'close')
            if (cleanupFails) close.mockRejectedValueOnce(new Error('cleanup failed'))
            await expect(
                MongoConnection.connect({ uri: 'mongodb://localhost:27017', dbName: 'unused' })
            ).rejects.toBe(failure)
            expect(close).toHaveBeenCalledOnce()
        }
    )
})
