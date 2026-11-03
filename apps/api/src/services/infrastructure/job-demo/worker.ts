import { defineWorkflow, RestateWorkflowClient } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { TextJobInputSchema, TextJobResultSchema, type TextJobResult } from './dtos.js'
import { JobDemoRepository } from './job-demo.repository.js'

@Injectable()
export class TextJobWorkflow {
    readonly definition
    constructor(repository: JobDemoRepository, config: AppConfigService) {
        this.definition = defineWorkflow({
            name: 'TextJob-' + config.projectId,
            input: TextJobInputSchema,
            run: async (ctx, input) => {
                const result = await ctx.run(
                    'uppercase text',
                    async () => {
                        const text = input.text.toUpperCase()
                        return { text, characterCount: [...text].length }
                    },
                    {}
                )
                await ctx.run(
                    'store result',
                    async () => repository.complete(input.jobId, result),
                    { initialRetryInterval: 1000 }
                )
                return result
            },
            options: {
                abortTimeout: 5000,
                inactivityTimeout: 65000,
                workflowRetention: 24 * 60 * 60 * 1000
            }
        })
    }
}
@Injectable()
export class TextJobWorkflowClient extends RestateWorkflowClient<
    { jobId: string; text: string },
    TextJobResult
> {
    constructor(workflow: TextJobWorkflow, config: AppConfigService) {
        super(workflow.definition, config.restate.ingressUrl, TextJobResultSchema)
    }
}
