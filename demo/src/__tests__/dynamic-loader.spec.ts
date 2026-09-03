import 'reflect-metadata'
import { loadAppRuntime } from '../testing/load-app-runtime.js'

// setup.ts가 만든 원래 값을 보존한다. 이 테스트는 process.env를 일부러 바꾸므로
// 끝난 뒤 복구하지 않으면 같은 worker에서 뒤이어 실행될 코드에 영향을 줄 수 있다.
const workerNamespace = process.env.MESSAGE_NAMESPACE

// afterEach는 테스트가 중간 assertion에서 실패해도 실행된다.
afterEach(() => {
    process.env.MESSAGE_NAMESPACE = workerNamespace

    // vi.resetModules()는 Vitest가 관리하는 ESM 모듈 캐시를 비운다. process.env,
    // mock 등록, 이미 변수에 담아 둔 class 객체까지 원상 복구하는 함수는 아니다.
    vi.resetModules()
})

it('reset 이후 중앙 loader를 호출하면 @MessagePattern을 새 namespace로 다시 평가한다', async () => {
    // 첫 번째 독립 모듈 그래프를 demo-first 환경에서 만든다.
    process.env.MESSAGE_NAMESPACE = 'demo-first'
    vi.resetModules()
    const first = await loadAppRuntime()

    // 캐시를 비운 뒤 같은 소스 파일을 demo-second 환경에서 다시 평가한다.
    process.env.MESSAGE_NAMESPACE = 'demo-second'
    vi.resetModules()
    const second = await loadAppRuntime()

    // 모듈 최상위에서 만든 subject 상수가 각각의 환경 값을 반영했는지 확인한다.
    expect(first.MessagePatterns.calculator.add).toBe('demo-first.message.calculator.add')
    expect(second.MessagePatterns.calculator.add).toBe('demo-second.message.calculator.add')

    // 상수만 바뀐 것으로는 부족하다. @MessagePattern이 메서드에 기록한 실제 Nest
    // metadata도 새 subject인지 검사해야 server가 그 subject를 구독한다고 확신할 수 있다.
    expect(
        Reflect.getMetadata(first.PATTERN_METADATA, first.CalculatorController.prototype.add)
    ).toEqual(['demo-first.message.calculator.add'])
    expect(
        Reflect.getMetadata(second.PATTERN_METADATA, second.CalculatorController.prototype.add)
    ).toEqual(['demo-second.message.calculator.add'])

    // ESM 모듈을 정말 다시 평가했다면 export된 class도 서로 다른 객체다. 이 검사는
    // controller와 module 중 일부만 과거 캐시에서 섞여 들어오는 실수를 찾아낸다.
    expect(first.CalculatorController).not.toBe(second.CalculatorController)
    expect(first.CalculatorModule).not.toBe(second.CalculatorModule)
})
