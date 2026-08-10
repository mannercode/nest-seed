describe('AppModule', () => {
    it('실제 AppModule 그래프에서 모든 모듈, 컨트롤러, 가드를 주입할 수 있다', async () => {
        // `resetModules: true` 환경에서는 NestJS 내부 토큰(`ModuleRef` 등)이 두 실행 영역으로 갈라지지 않도록, 모든 모듈을 같은 그래프에서 동적으로 가져온다.
        const { createAppTestContext } = await import('./helpers')
        const ctx = await createAppTestContext()

        await ctx.close()
    })
})
