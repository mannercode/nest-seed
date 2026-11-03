import { CrudDocument, CrudRepository, MongoConnection, MongoErrors } from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { AppConfigService } from '#config'
import type { TextJobResult } from './dtos.js'
class TextJob extends CrudDocument {
    userId: string
    result: TextJobResult | null
}
@Injectable()
export class JobDemoRepository extends CrudRepository<TextJob> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection,
            'textjobs',
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize
        )
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
