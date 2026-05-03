/**
 * Smoke test: instantiate the real AppModule end-to-end so DI graph errors
 * surface in unit tests. Domain spec files build ad-hoc test modules that
 * declare exactly the controllers/providers they need, so they will not
 * notice when AppModule wiring drifts (e.g. a controller moved to a sibling
 * module without its required imports). This test catches that.
 */
describe('AppModule', () => {
    // 모든 모듈/컨트롤러/가드의 DI 가 실제 AppModule 그래프 위에서 해소된다
    it('compiles with all dependencies resolved', async () => {
        // jest 의 resetModules:true 때문에 NestJS 내부 토큰 (ModuleRef 등) 이
        // 두 그래프로 갈라지지 않도록 모든 import 를 같은 모듈 그래프 안에서
        // 동적으로 가져온다.
        const { Test } = await import('@nestjs/testing')
        const { AppModule } = await import('../app.module')
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
        await moduleRef.close()
    })
})
