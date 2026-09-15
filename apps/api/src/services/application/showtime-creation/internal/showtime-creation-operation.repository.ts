import { type TransactionContext, CrudRepository, MongoConnection } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import type { ValidateAndCreateResult } from './types.js'
import { ShowtimeCreationOperation } from './models/index.js'

const COMMIT_TIMEOUT_MS = 10_000
// 콜백 재시도까지 Activity 한 시도 안에서 끝낸다. commit 제한은 전체 실행을 제한하지 않는다.
const TRANSACTION_TIMEOUT_MS = 45_000

@Injectable()
export class ShowtimeCreationOperationRepository extends CrudRepository<ShowtimeCreationOperation> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection,
            'showtimecreationoperations',
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            { hardDelete: true, indexes: [{ key: { sagaId: 1 }, unique: true }] }
        )
    }

    runTransaction<T>(callback: (transaction: TransactionContext) => Promise<T>): Promise<T> {
        return this.withTransaction(callback, {
            snapshot: { commitTimeoutMs: COMMIT_TIMEOUT_MS, timeoutMs: TRANSACTION_TIMEOUT_MS }
        })
    }

    async create(
        sagaId: string,
        inputHash: string,
        result: ValidateAndCreateResult,
        transaction: TransactionContext,
        signal: AbortSignal | undefined
    ) {
        const operation = this.newDocument()
        operation.sagaId = sagaId
        operation.inputHash = inputHash
        operation.result = result
        await this.insertOne(operation, transaction, signal)
    }

    async findBySagaId({
        sagaId,
        transaction,
        signal
    }: {
        sagaId: string
        transaction: TransactionContext
        signal: AbortSignal | undefined
    }) {
        const operation = await this.findDocument({ sagaId }, { transaction, signal })
        return operation ? this.toDomainDocument(operation) : null
    }
}
