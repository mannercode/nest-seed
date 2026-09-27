import { MongoClient, type Db } from 'mongodb'
import type { MockInstance } from 'vitest'
import { Test } from '@nestjs/testing'
import { Global, Module } from '@nestjs/common'
import { MongoConnection, MongoModule } from '../index.js'

describe('MongoConnection', () => {
    describe('client를 소유하는 연결이면', () => {
        let client: MongoClient
        let connection: MongoConnection
        beforeEach(() => {
            client = { close: vi.fn() } as unknown as MongoClient
            connection = new MongoConnection(client, {} as Db)
        })
        it('모듈 종료 시 client를 닫는다', async () => {
            await connection.onModuleDestroy()

            expect(client.close).toHaveBeenCalledOnce()
        })
    })

    describe('공유 client를 사용하는 연결이면', () => {
        let client: MongoClient
        let connection: MongoConnection
        beforeEach(() => {
            client = { close: vi.fn() } as unknown as MongoClient
            connection = new MongoConnection(client, {} as Db, false)
        })
        it('모듈 종료 시 client를 닫지 않는다', async () => {
            await connection.onModuleDestroy()

            expect(client.close).not.toHaveBeenCalled()
        })
    })
})

describe('MongoModule', () => {
    describe.each([
        { condition: '최소 연결 풀 크기를 지정하지 않았으면', minPoolSize: undefined },
        { condition: '최소 연결 풀 크기가 50이면', minPoolSize: 50 }
    ])('$condition', ({ minPoolSize }) => {
        let options: { uri: string; dbName: string; minPoolSize: number | undefined }
        beforeEach(() => {
            options = {
                uri: process.env.TESTLIB_MONGO_URI!,
                dbName: process.env.TESTLIB_MONGO_DATABASE!,
                minPoolSize
            }
        })
        it('모듈을 초기화하면 설정대로 연결하고 종료하면 client를 닫는다', async () => {
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
        })
    })
})

describe('MongoConnection.connect', () => {
    describe.each([
        { label: '정상 종료되면', cleanupFails: false },
        { label: '종료도 실패하면', cleanupFails: true }
    ])('연결이 실패하고 정리할 때 $label', ({ cleanupFails }) => {
        let failure: Error
        let close: MockInstance<MongoClient['close']>
        beforeEach(() => {
            failure = new Error('connect failed')
            vi.spyOn(MongoClient.prototype, 'connect').mockRejectedValueOnce(failure)
            close = vi.spyOn(MongoClient.prototype, 'close')
            if (cleanupFails) close.mockRejectedValueOnce(new Error('cleanup failed'))
        })
        it('연결을 요청하면 client를 닫고 최초 연결 오류를 던진다', async () => {
            await expect(
                MongoConnection.connect({ uri: 'mongodb://localhost:27017', dbName: 'unused' })
            ).rejects.toBe(failure)
            expect(close).toHaveBeenCalledOnce()
        })
    })
})
