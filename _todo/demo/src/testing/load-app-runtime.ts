// 이 파일은 앱 모듈을 정적으로 import하지 않는다. 정적 import가 하나라도 있으면
// 테스트 파일을 평가할 때 그 모듈이 먼저 캐시되어 vi.resetModules()의 효과를 잃기 쉽다.
export async function loadAppRuntime() {
    // vi.resetModules() 다음에 이 함수를 호출하면 아래 dynamic import들이 모두 현재
    // namespace로 다시 평가된다. controller, pattern, module을 따로 로드하는 것처럼 보여도
    // ESM loader의 한 모듈 그래프를 공유하므로 Nest가 참조하는 class identity가 일치한다.
    const [
        { PATTERN_METADATA },
        { CalculatorController },
        { CalculatorModule },
        { MessagePatterns }
    ] = await Promise.all([
        import('@nestjs/microservices/constants'),
        import('../calculator.controller.js'),
        import('../calculator.module.js'),
        import('../message-patterns.js')
    ])

    // PATTERN_METADATA까지 반환하는 이유는 테스트가 @MessagePattern 데코레이터가 남긴
    // Reflect metadata를 직접 읽어 새 namespace가 등록됐는지 확인하기 위해서다.
    return { CalculatorController, CalculatorModule, MessagePatterns, PATTERN_METADATA }
}
