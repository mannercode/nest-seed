import type { ClientSession, Model } from 'mongoose'
import { CrudRepository } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from '#config'
import type { ValidateAndCreateResult } from './types.js'
import { ShowtimeCreationOperation } from './models/index.js'

@Injectable()
export class ShowtimeCreationOperationRepository extends CrudRepository<ShowtimeCreationOperation> {
    constructor(
        @InjectModel(ShowtimeCreationOperation.name, MONGO_CONNECTION_NAME)
        readonly model: Model<ShowtimeCreationOperation>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
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
        await this.saveMany([operation], session, signal)
    }

    async findBySagaId(sagaId: string, session: ClientSession, signal: AbortSignal | undefined) {
        return this.model.findOne({ sagaId }, null, { session, signal }).lean().exec()
    }
}
