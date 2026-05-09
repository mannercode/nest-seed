/**
 * Smoke test: 실제 AppModule을 end-to-end로 인스턴스화하여 DI 그래프 오류가
 * 유닛 테스트에서 드러나도록 한다. 도메인 spec 파일들은 필요한 컨트롤러/프로바이더만
 * 선언하는 ad-hoc 테스트 모듈을 만들기 때문에, AppModule의 wiring이 어긋나는 경우
 * (예: 컨트롤러가 필수 import 없이 다른 모듈로 이동)를 감지하지 못한다. 이 테스트가
 * 그런 경우를 잡아낸다.
 */
describe('AppModule', () => {
    it('모든 모듈/컨트롤러/가드의 DI가 실제 AppModule 그래프 위에서 해소된다', async () => {
        // jest의 resetModules:true 때문에 NestJS 내부 토큰(ModuleRef 등)이 두 그래프로
        // 갈라지지 않도록 모든 import를 같은 모듈 그래프 안에서 동적으로 가져온다.
        const { Test } = await import('@nestjs/testing')
        const { AppModule } = await import('../../app.module')
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
        await moduleRef.close()
    })
})
