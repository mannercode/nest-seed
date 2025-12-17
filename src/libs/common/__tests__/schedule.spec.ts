import { CronExpression } from '@nestjs/schedule'
import { sleep } from '../utils'
import { ScheduleModuleFixture } from './schedule.fixture'

describe('ScheduleModule', () => {
    let fix: ScheduleModuleFixture

    beforeEach(async () => {
        const { createScheduleModuleFixture } = await import('./schedule.fixture')
        fix = await createScheduleModuleFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('when using the default schedule', () => {
        it('runs the sample job every two seconds', async () => {
            fix.sampleJobService.reset()

            await sleep(2500)

            expect([1, 2]).toContain(fix.sampleJobService.count)
        })
    })

    describe('when updating the cron schedule at runtime', () => {
        it('runs the sample job every second', async () => {
            const { CronTime } = await import('cron')
            const job = fix.scheduler.getCronJob('job')
            await job.stop()

            job.setTime(new CronTime(CronExpression.EVERY_SECOND))
            job.start()

            fix.sampleJobService.reset()

            await sleep(1500)

            expect([1, 2]).toContain(fix.sampleJobService.count)
        })
    })
})
