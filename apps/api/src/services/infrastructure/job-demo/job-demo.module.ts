import { Module } from '@nestjs/common'
import { JobDemoService } from './job-demo.service.js'
import { JobDemoRepository } from './job-demo.repository.js'
import { TextJobWorkflow, TextJobWorkflowClient } from './worker.js'
@Module({
    providers: [JobDemoService, JobDemoRepository, TextJobWorkflow, TextJobWorkflowClient],
    exports: [JobDemoService, TextJobWorkflow]
})
export class JobDemoModule {}
