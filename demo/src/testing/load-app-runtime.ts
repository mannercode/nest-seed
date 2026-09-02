// 이 파일은 앱 모듈을 정적으로 가져오지 않는다. vi.resetModules() 뒤 호출하면
// controller, pattern, module이 모두 같은 새 모듈 그래프에서 로드된다.
export async function loadAppRuntime() {
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

    return { CalculatorController, CalculatorModule, MessagePatterns, PATTERN_METADATA }
}
