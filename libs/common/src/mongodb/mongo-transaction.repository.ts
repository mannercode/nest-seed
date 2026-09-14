import type { ClientSession, MongoClient } from 'mongodb'
import type { TransactionContext } from '../transaction.js'
import { ensure } from '../utils/index.js'
import type { MongoConnection } from './mongo-connection.js'

type TransactionOptions = { snapshot?: { commitTimeoutMs: number; timeoutMs: number } }

// 다른 Repository도 같은 트랜잭션에 참여하되 세션은 저장소 구현 안에서만 사용한다.
const sessions = new Map<TransactionContext, ClientSession>()

export abstract class MongoTransactionRepository {
    protected readonly client: MongoClient

    constructor(connection: MongoConnection) {
        this.client = connection.client
    }

    async withTransaction<T>(
        callback: (transaction: TransactionContext) => Promise<T>,
        options: TransactionOptions = {}
    ): Promise<T> {
        const session = this.client.startSession()
        try {
            return await session.withTransaction(
                async () => {
                    // 드라이버가 콜백을 재시도하면 이전 시도의 식별자는 재사용하지 않는다.
                    const transaction = Symbol('transaction')
                    sessions.set(transaction, session)
                    try {
                        return await callback(transaction)
                    } finally {
                        sessions.delete(transaction)
                    }
                },
                options.snapshot
                    ? {
                          maxCommitTimeMS: options.snapshot.commitTimeoutMs,
                          timeoutMS: options.snapshot.timeoutMs,
                          readConcern: { level: 'snapshot' },
                          writeConcern: { w: 'majority' }
                      }
                    : {}
            )
        } finally {
            await session.endSession()
        }
    }

    protected getSession(transaction: TransactionContext | undefined): ClientSession | undefined {
        if (transaction === undefined) return undefined
        return ensure(sessions.get(transaction), 'Transaction context is no longer active.')
    }
}
