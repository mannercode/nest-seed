import type { Db, MongoClient } from 'mongodb'
import { MongoConnection } from '../connections.js'

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
