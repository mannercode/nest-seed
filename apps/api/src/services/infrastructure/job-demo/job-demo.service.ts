import { Injectable } from '@nestjs/common'
import { CreateTextJobSchema, type CreateTextJobDto, type TextJobDto } from './dtos.js'
import { JobDemoRepository } from './job-demo.repository.js'
import { TextJobWorkflowClient } from './worker.js'
@Injectable()
export class JobDemoService {
    constructor(
        private readonly repository: JobDemoRepository,
        private readonly workflow: TextJobWorkflowClient
    ) {}
    async submit(userId: string, input: CreateTextJobDto) {
        const { text } = CreateTextJobSchema.parse(input)
        const job = await this.repository.create(userId)
        await this.workflow.submit({ jobId: job.id, text }, job.id)
        return { jobId: job.id }
    }
    async getStatus(userId: string, jobId: string): Promise<TextJobDto> {
        const job = await this.repository.getForUser(jobId, userId)
        return job.result === null
            ? { jobId, status: 'pending' }
            : { jobId, status: 'completed', result: job.result }
    }
}
