import 'reflect-metadata'
import { loadAppRuntime } from '../testing/load-app-runtime.js'

const workerNamespace = process.env.MESSAGE_NAMESPACE

afterEach(() => {
    process.env.MESSAGE_NAMESPACE = workerNamespace
    vi.resetModules()
})

it('reset 이후 중앙 loader를 호출하면 @MessagePattern을 새 namespace로 다시 평가한다', async () => {
    process.env.MESSAGE_NAMESPACE = 'demo-first'
    vi.resetModules()
    const first = await loadAppRuntime()

    process.env.MESSAGE_NAMESPACE = 'demo-second'
    vi.resetModules()
    const second = await loadAppRuntime()

    expect(first.MessagePatterns.calculator.add).toBe('demo-first.message.calculator.add')
    expect(second.MessagePatterns.calculator.add).toBe('demo-second.message.calculator.add')
    expect(
        Reflect.getMetadata(first.PATTERN_METADATA, first.CalculatorController.prototype.add)
    ).toEqual(['demo-first.message.calculator.add'])
    expect(
        Reflect.getMetadata(second.PATTERN_METADATA, second.CalculatorController.prototype.add)
    ).toEqual(['demo-second.message.calculator.add'])
    expect(first.CalculatorController).not.toBe(second.CalculatorController)
    expect(first.CalculatorModule).not.toBe(second.CalculatorModule)
})
