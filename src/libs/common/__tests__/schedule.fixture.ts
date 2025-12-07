import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression, ScheduleModule, SchedulerRegistry } from '@nestjs/schedule'
import { CronTime } from 'cron'
import { createTestContext } from 'testlib'

@Injectable()
export class SampleJobService {
    private readonly logger = new Logger(SampleJobService.name)
    executionCount = 0

    static readonly JOB_NAME = 'sample-job'

    @Cron(CronExpression.EVERY_MINUTE, { name: SampleJobService.JOB_NAME })
    handleCron() {
        this.executionCount += 1
        this.logger.debug('Sample cron executed')
    }

    resetExecutionCount() {
        this.executionCount = 0
    }
}

@Injectable()
export class CronControlService {
    private readonly logger = new Logger(CronControlService.name)

    constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

    updateSampleJobExpression(cronExpr: string) {
        const job = this.schedulerRegistry.getCronJob(SampleJobService.JOB_NAME)

        this.logger.log(`Updating cron [${SampleJobService.JOB_NAME}] to "${cronExpr}"`)

        job.setTime(new CronTime(cronExpr))
        job.start()
    }
}

export type ScheduleModuleFixture = {
    teardown: () => Promise<void>
    schedulerRegistry: SchedulerRegistry
    sampleJobService: SampleJobService
    cronControlService: CronControlService
}

export async function createScheduleModuleFixture(): Promise<ScheduleModuleFixture> {
    const testContext = await createTestContext({
        imports: [ScheduleModule.forRoot()],
        providers: [SampleJobService, CronControlService],
        exports: [SampleJobService, CronControlService]
    })

    const schedulerRegistry = testContext.module.get(SchedulerRegistry)
    const sampleJobService = testContext.module.get(SampleJobService)
    const cronControlService = testContext.module.get(CronControlService)

    async function teardown() {
        await testContext.close()
    }

    return { teardown, schedulerRegistry, sampleJobService, cronControlService }
}
