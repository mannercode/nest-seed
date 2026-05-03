import { extractRootMessage } from '../extract-root-message'

describe('extractRootMessage', () => {
    // 일반 Error 는 자기 message 를 그대로 반환한다
    it('returns the message of a plain Error', () => {
        expect(extractRootMessage(new Error('plain'))).toBe('plain')
    })

    // cause 체인 끝의 leaf message 를 반환한다 (Temporal ActivityFailure → ApplicationFailure → 실제 에러)
    it('walks cause chain to the deepest message', () => {
        const root = new Error('root cause')
        const wrapped = new Error('wrapper', { cause: root })
        const outer = new Error('Activity task failed', { cause: wrapped })
        expect(extractRootMessage(outer)).toBe('root cause')
    })

    // SuppressedError 의 suppressed 가 원본 에러이므로 그것을 우선한다 (await using disposal race)
    it('prefers SuppressedError.suppressed over its own message', () => {
        const original = new Error('movie not found')
        const disposal = new Error('Connection is closed')
        // ESM SuppressedError 흉내 — 실제 런타임이 같은 형태의 객체를 생성한다
        const suppressed = Object.assign(new Error('An error was suppressed during disposal'), {
            error: disposal,
            suppressed: original
        })
        expect(extractRootMessage(suppressed)).toBe('movie not found')
    })

    // suppressed 가 cause 보다 우선한다
    it('prefers suppressed over cause when both are present', () => {
        const suppressedLeaf = new Error('suppressed leaf')
        const causeLeaf = new Error('cause leaf')
        const wrapper = Object.assign(new Error('wrapper'), {
            cause: causeLeaf,
            suppressed: suppressedLeaf
        })
        expect(extractRootMessage(wrapper)).toBe('suppressed leaf')
    })

    // 자기 자신을 cause 로 가지면 무한 루프 없이 종료된다
    it('terminates on self-referencing cause', () => {
        const self: Error & { cause?: unknown } = new Error('self')
        self.cause = self
        expect(extractRootMessage(self)).toBe('self')
    })

    // Error 가 아닌 값은 String() 으로 변환된다
    it('falls back to String() for non-Error throws', () => {
        expect(extractRootMessage('boom')).toBe('boom')
        expect(extractRootMessage(42)).toBe('42')
        expect(extractRootMessage(null)).toBe('null')
    })

    // Error 인데 message 가 빈 문자열이고 cause 가 없으면 String() fallback
    it('falls back to String() when Error message is empty and no chain', () => {
        const blank = new Error('')
        expect(extractRootMessage(blank)).toBe(String(blank))
    })
})
