// AppModule의 DI 그래프만 빠르게 검증합니다. fixture 기반 통합 테스트도 같은
// 모듈을 시작하지만 HTTP 서버, 로거, cron 제어까지 함께 지나가므로 DI 문제만
// 분리해 보기 어렵습니다. 이 spec은 `compile()`까지만 실행해 모듈 wiring
// 회귀를 가장 먼저 드러냅니다.
describe('AppModule', () => {
    it('모든 모듈/컨트롤러/가드의 DI가 실제 AppModule 그래프 위에서 해소된다', async () => {
        // `resetModules: true` 환경에서는 NestJS 내부 토큰(`ModuleRef` 등)이
        // 두 realm으로 갈라지지 않도록, 모든 import를 같은 그래프에서
        // 동적으로 가져옵니다.
        const { Test } = await import('@nestjs/testing')
        const { AppModule } = await import('../../app.module')
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
        await moduleRef.close()
    })
})
