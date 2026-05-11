// `AppModule` 을 가장 가벼운 방식으로 부팅한다. fixture 도 같은 모듈을
// 통째로 띄우지만, 그쪽은 HTTP, Logger, cron 중단까지 함께 끼므로 실패
// 원인을 분리하기 어렵다. 이 spec 은 `compile()` 만 해서, DI 그래프 자체가
// 어긋났을 때 가장 먼저 빨갛게 떨어지는 자리를 만든다.
describe('AppModule', () => {
    it('모든 모듈/컨트롤러/가드의 DI가 실제 AppModule 그래프 위에서 해소된다', async () => {
        // `resetModules: true` 환경에서는 NestJS 내부 토큰(`ModuleRef` 등)이
        // 두 realm 으로 갈라지지 않도록, 모든 import 를 같은 그래프에서
        // 동적으로 가져온다.
        const { Test } = await import('@nestjs/testing')
        const { AppModule } = await import('../../app.module')
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
        await moduleRef.close()
    })
})
