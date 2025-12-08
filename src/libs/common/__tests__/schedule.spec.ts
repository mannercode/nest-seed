import { CronExpression } from '@nestjs/schedule'
import { sleep } from '../utils'
import { ScheduleModuleFixture } from './schedule.fixture'

describe('ScheduleModule', () => {
    let fixture: ScheduleModuleFixture

    beforeEach(async () => {
        const { createScheduleModuleFixture } = await import('./schedule.fixture')
        fixture = await createScheduleModuleFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    it('runs the sample job every two seconds with the default schedule', async () => {
        fixture.sampleJobService.reset()

        await sleep(2500)

        const { count } = fixture.sampleJobService
        expect(count === 1 || count === 2).toBe(true)
    })

    it('updates the cron schedule at runtime and runs every second', async () => {
        const { CronTime } = await import('cron')
        const job = fixture.scheduler.getCronJob('job')
        await job.stop()

        job.setTime(new CronTime(CronExpression.EVERY_SECOND))
        job.start()

        fixture.sampleJobService.reset()

        await sleep(1500)

        const { count } = fixture.sampleJobService
        expect(count === 1 || count === 2).toBe(true)
    })
})
