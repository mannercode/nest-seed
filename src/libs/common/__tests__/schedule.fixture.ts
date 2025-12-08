import { Injectable } from '@nestjs/common'
import { Cron, ScheduleModule, SchedulerRegistry } from '@nestjs/schedule'
import { createTestContext } from 'testlib'

@Injectable()
export class SampleJobService {
    private _count = 0

    @Cron('*/2 * * * * *', { name: 'job' })
    handleCron() {
        this._count += 1
        console.log('handleCron()', this._count)
    }

    reset() {
        this._count = 0
    }

    get count() {
        return this._count
    }
}

export type ScheduleModuleFixture = {
    teardown: () => Promise<void>
    scheduler: SchedulerRegistry
    sampleJobService: SampleJobService
}

export async function createScheduleModuleFixture(): Promise<ScheduleModuleFixture> {
    const { module, close } = await createTestContext({
        imports: [ScheduleModule.forRoot()],
        providers: [SampleJobService],
        exports: [SampleJobService]
    })

    const scheduler = module.get(SchedulerRegistry)
    const sampleJobService = module.get(SampleJobService)

    async function teardown() {
        await close()
    }

    return { teardown, scheduler, sampleJobService }
}
