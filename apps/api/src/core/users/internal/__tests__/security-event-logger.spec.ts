import { SecurityEventLogger } from '..'

describe('SecurityEventLogger', () => {
    let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock }
    let svc: SecurityEventLogger

    beforeEach(() => {
        logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
        svc = new SecurityEventLogger(logger as any)
    })

    // 고위험 — error 레벨로 기록
    it('logs token.reuse_detected at error level', () => {
        const event = {
            type: 'token.reuse_detected' as const,
            familyId: 'f1',
            presentedTokenId: 't1',
            at: new Date()
        }
        svc.handle(event)

        expect(logger.error).toHaveBeenCalledWith('security_event:token.reuse_detected', event)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(logger.log).not.toHaveBeenCalled()
    })

    // 검증 실패 — warn 레벨
    it('logs verify.failed at warn level', () => {
        const event = { type: 'verify.failed' as const, reason: 'jwt malformed', at: new Date() }
        svc.handle(event)

        expect(logger.warn).toHaveBeenCalledWith('security_event:verify.failed', event)
        expect(logger.error).not.toHaveBeenCalled()
        expect(logger.log).not.toHaveBeenCalled()
    })

    // 일반 동작 — log 레벨 (3종)
    it.each([
        ['family.revoked', { reason: 'logout' }],
        ['token.issued', { tokenId: 't1' }],
        ['token.refreshed', { oldTokenId: 'o1', newTokenId: 'n1' }]
    ] as const)('logs %s at info level', (type, extra) => {
        const event = { type, familyId: 'f1', at: new Date(), ...extra } as any
        svc.handle(event)

        expect(logger.log).toHaveBeenCalledWith(`security_event:${type}`, event)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })
})
