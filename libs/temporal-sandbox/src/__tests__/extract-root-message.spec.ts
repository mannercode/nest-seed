import { extractRootMessage } from '../extract-root-message'

describe('extractRootMessage', () => {
    it('일반 Error 객체는 자신의 메시지를 그대로 반환한다', () => {
        expect(extractRootMessage(new Error('plain'))).toBe('plain')
    })

    it('cause 체인을 따라 가장 안쪽 메시지를 반환한다', () => {
        const root = new Error('root cause')
        const wrapped = new Error('wrapper', { cause: root })
        const outer = new Error('Activity task failed', { cause: wrapped })
        expect(extractRootMessage(outer)).toBe('root cause')
    })

    it('SuppressedError가 있으면 suppressed 메시지를 우선한다', () => {
        const original = new Error('movie not found')
        const disposal = new Error('Connection is closed')
        // ESM SuppressedError 흉내. 실제 런타임이 같은 형태의 객체를 만듭니다.
        const suppressed = Object.assign(new Error('An error was suppressed during disposal'), {
            error: disposal,
            suppressed: original
        })
        expect(extractRootMessage(suppressed)).toBe('movie not found')
    })

    it('suppressed와 cause가 모두 있으면 suppressed를 우선한다', () => {
        const suppressedLeaf = new Error('suppressed leaf')
        const causeLeaf = new Error('cause leaf')
        const wrapper = Object.assign(new Error('wrapper'), {
            cause: causeLeaf,
            suppressed: suppressedLeaf
        })
        expect(extractRootMessage(wrapper)).toBe('suppressed leaf')
    })

    it('자기 자신을 cause로 가져도 무한 루프 없이 종료된다', () => {
        const self: Error & { cause?: unknown } = new Error('self')
        self.cause = self
        expect(extractRootMessage(self)).toBe('self')
    })

    it('Error 객체가 아닌 값은 String() 결과로 변환한다', () => {
        expect(extractRootMessage('boom')).toBe('boom')
        expect(extractRootMessage(42)).toBe('42')
        expect(extractRootMessage(null)).toBe('null')
    })

    it('Error 메시지가 비어 있고 체인이 없으면 String() 결과를 쓴다', () => {
        const blank = new Error('')
        expect(extractRootMessage(blank)).toBe(String(blank))
    })
})
