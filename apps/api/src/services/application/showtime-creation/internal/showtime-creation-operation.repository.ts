import type { ClientSession } from 'mongodb'
import { CrudRepository } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService, MongoConnection } from '#config'
import type { ValidateAndCreateResult } from './types.js'
import { ShowtimeCreationOperation } from './models/index.js'

@Injectable()
export class ShowtimeCreationOperationRepository extends CrudRepository<ShowtimeCreationOperation> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('showtimecreationoperations'),
            connection.client,
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            { hardDelete: true, indexes: [{ key: { sagaId: 1 }, unique: true }] }
        )
    }

    async create(
        sagaId: string,
        inputHash: string,
        result: ValidateAndCreateResult,
        session: ClientSession,
        signal: AbortSignal | undefined
    ) {
        const operation = this.newDocument()
        operation.sagaId = sagaId
        operation.inputHash = inputHash
        operation.result = result
        await this.insertOne(operation, session, signal)
    }

    async findBySagaId(sagaId: string, session: ClientSession, signal: AbortSignal | undefined) {
        return this.collection.findOne({ sagaId }, { session, signal })
    }
}
