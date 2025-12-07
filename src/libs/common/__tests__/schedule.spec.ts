import { SampleJobService, ScheduleModuleFixture } from './schedule.fixture'

describe('ScheduleModule + @Cron runtime update', () => {
    let fixture: ScheduleModuleFixture

    beforeEach(async () => {
        const { createScheduleModuleFixture } = await import('./schedule.fixture')
        fixture = await createScheduleModuleFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    it('ScheduleModule.forRoot() + @Cron 으로 cron job 이 등록되어 있어야 한다', () => {
        const job = fixture.schedulerRegistry.getCronJob(SampleJobService.JOB_NAME)
        expect(job).toBeDefined()
    })

    it('기본 설정에서 fireOnTick()을 호출하면 handleCron 이 실행된다', async () => {
        const job = fixture.schedulerRegistry.getCronJob(SampleJobService.JOB_NAME)

        await job.fireOnTick()

        expect(fixture.sampleJobService.executionCount).toBe(1)
    })

    it('런타임에 cron 표현식을 변경한 뒤에도 job 을 실행할 수 있다', async () => {
        const newExpr = '*/5 * * * * *' // 5초마다

        // 에러 없이 표현식을 변경할 수 있어야 한다
        fixture.cronControlService.updateSampleJobExpression(newExpr)

        // 여전히 같은 이름으로 job 을 가져올 수 있어야 한다
        const job = fixture.schedulerRegistry.getCronJob(SampleJobService.JOB_NAME)

        await job.fireOnTick()

        expect(fixture.sampleJobService.executionCount).toBe(1)
    })
})
