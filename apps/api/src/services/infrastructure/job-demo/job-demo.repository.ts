import {
    CrudDocument,
    MongoConnection,
    MongoDocumentRepository,
    MongoErrors
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import type { TextJobResult } from './dtos.js'
class TextJob extends CrudDocument {
    userId: string
    result: TextJobResult | null
}
@Injectable()
export class JobDemoRepository extends MongoDocumentRepository<TextJob> {
    constructor(connection: MongoConnection) {
        super(connection, 'textjobs')
    }
    async create(userId: string) {
        const job = this.newDocument()
        job.userId = userId
        job.result = null
        return this.insertOne(job)
    }
    async getForUser(jobId: string, userId: string) {
        const job = await this.findDocument(this.activeFilter({ ...this.idFilter(jobId), userId }))
        if (!job) throw new NotFoundException(MongoErrors.DocumentNotFound(jobId))
        return job
    }
    async complete(jobId: string, result: TextJobResult) {
        await this.updateDocument(
            this.activeFilter(this.idFilter(jobId)),
            this.timestamped({ $set: { result } })
        )
    }
}
