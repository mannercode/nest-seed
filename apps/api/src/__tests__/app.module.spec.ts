import { createAppTestContext } from './helpers/index.js'
import { AppConfigService } from '#config'
describe('AppModule', () => {
    it('실제 AppModule 그래프가 현재 테스트의 PROJECT_ID로 모든 의존성을 만든다', async () => {
        const ctx = await createAppTestContext()

        expect(ctx.module.get(AppConfigService).projectId).toBe(process.env.PROJECT_ID)

        await ctx.close()
    })
})
