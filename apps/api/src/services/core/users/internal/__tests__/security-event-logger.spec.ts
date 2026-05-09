import { SecurityEventLogger } from '..'

describe('SecurityEventLogger', () => {
    let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock }
    let svc: SecurityEventLogger

    beforeEach(() => {
        logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
        svc = new SecurityEventLogger(logger as any)
    })

    it('token.reuse_detected는 error 레벨로 기록한다', () => {
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

    it('verify.failed는 warn 레벨로 기록한다', () => {
        const event = { type: 'verify.failed' as const, reason: 'jwt malformed', at: new Date() }
        svc.handle(event)

        expect(logger.warn).toHaveBeenCalledWith('security_event:verify.failed', event)
        expect(logger.error).not.toHaveBeenCalled()
        expect(logger.log).not.toHaveBeenCalled()
    })

    it('family.revoked는 info 레벨로 기록한다', () => {
        const event = {
            type: 'family.revoked' as const,
            familyId: 'f1',
            reason: 'logout',
            at: new Date()
        } as any
        svc.handle(event)

        expect(logger.log).toHaveBeenCalledWith('security_event:family.revoked', event)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it('token.issued는 info 레벨로 기록한다', () => {
        const event = {
            type: 'token.issued' as const,
            familyId: 'f1',
            tokenId: 't1',
            at: new Date()
        } as any
        svc.handle(event)

        expect(logger.log).toHaveBeenCalledWith('security_event:token.issued', event)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it('token.refreshed는 info 레벨로 기록한다', () => {
        const event = {
            type: 'token.refreshed' as const,
            familyId: 'f1',
            oldTokenId: 'o1',
            newTokenId: 'n1',
            at: new Date()
        } as any
        svc.handle(event)

        expect(logger.log).toHaveBeenCalledWith('security_event:token.refreshed', event)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })
})
