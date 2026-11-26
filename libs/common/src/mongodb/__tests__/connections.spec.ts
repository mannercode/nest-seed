import { MongoClient, MongoInvalidArgumentError, MongoNotConnectedError } from 'mongodb'
import { Test } from '@nestjs/testing'
import { Module } from '@nestjs/common'
import { MongoConnection, MongoModule } from '#common/mongodb'

describe('MongoConnection', () => {
    let client: MongoClient
    beforeEach(async () => {
        client = await MongoClient.connect(process.env.TESTLIB_MONGO_URI!)
    })
    afterEach(() => client.close())

    describe('client를 소유하는 연결이면', () => {
        it('모듈 종료 후에는 DB에 접근할 수 없다', async () => {
            const connection = new MongoConnection(client, client.db())
            await connection.onModuleDestroy()
            await expect(connection.ping()).rejects.toThrow(MongoNotConnectedError)
        })
    })

    describe('공유 client를 사용하는 연결이면', () => {
        it('모듈 종료 후에도 DB에 접근할 수 있다', async () => {
            const connection = new MongoConnection(client, client.db(), false)
            await connection.onModuleDestroy()
            await expect(connection.ping()).resolves.toBeUndefined()
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
            @Module({ providers: [{ provide: config, useValue: options }], exports: [config] })
            class Configuration {}
            const module = await Test.createTestingModule({
                imports: [
                    MongoModule.forRootAsync({
                        imports: [Configuration],
                        inject: [config],
                        useFactory: async (value) => value
                    })
                ]
            }).compile()
            const connection = module.get(MongoConnection)
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
            await expect(connection.ping()).rejects.toThrow(MongoNotConnectedError)
        })
    })
})

describe('MongoConnection.connect', () => {
    describe('DB 이름이 유효하지 않으면', () => {
        const openClients = new Set<MongoClient>()
        beforeEach(() => {
            const connect = MongoClient.prototype.connect
            vi.spyOn(MongoClient.prototype, 'connect').mockImplementationOnce(function (
                this: MongoClient
            ) {
                this.once('topologyOpening', () => openClients.add(this))
                this.once('topologyClosed', () => openClients.delete(this))
                return connect.call(this)
            })
        })
        afterEach(async () => {
            await Promise.all(Array.from(openClients, (client) => client.close()))
        })
        it('열린 연결을 남기지 않고 DB 이름 오류를 던진다', async () => {
            await expect(
                MongoConnection.connect({ uri: process.env.TESTLIB_MONGO_URI!, dbName: 'bad.name' })
            ).rejects.toThrow(MongoInvalidArgumentError)
            expect(openClients.size).toBe(0)
        })
    })
    describe('연결에 실패하면', () => {
        const failure = new Error('connect failed')
        const options = { uri: 'mongodb://localhost:27017', dbName: 'unused' }
        beforeEach(() => {
            vi.spyOn(MongoClient.prototype, 'connect').mockRejectedValueOnce(failure)
        })
        it('연결 오류를 그대로 던진다', async () => {
            await expect(MongoConnection.connect(options)).rejects.toBe(failure)
        })
        describe('열린 연결을 닫는 데도 실패하면', () => {
            const cleanupError = new Error('cleanup failed')
            beforeEach(() => {
                vi.spyOn(MongoClient.prototype, 'close').mockRejectedValueOnce(cleanupError)
            })
            it('두 오류를 함께 던진다', async () => {
                await expect(MongoConnection.connect(options)).rejects.toMatchObject({
                    name: 'SuppressedError',
                    error: cleanupError,
                    suppressed: failure
                })
            })
        })
    })
})
