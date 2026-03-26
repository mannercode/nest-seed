import { CustomerAuthenticationService } from '..'

describe('CustomerAuthenticationService', () => {
    let service: CustomerAuthenticationService

    beforeEach(() => {
        service = new CustomerAuthenticationService({} as any, {} as any)
    })

    describe('hash', () => {
        // 해시된 비밀번호를 반환한다
        it('returns hashed password', async () => {
            const hashedPassword = await service.hash('password')

            expect(hashedPassword).not.toEqual('password')
        })

        // 같은 비밀번호라도 다른 해시를 반환한다
        it('returns different hashes for the same password', async () => {
            const hash1 = await service.hash('password')
            const hash2 = await service.hash('password')

            expect(hash1).not.toEqual(hash2)
        })
    })

    describe('validate', () => {
        let hashedPassword: string

        beforeEach(async () => {
            hashedPassword = await service.hash('password')
        })

        // 일치하는 비밀번호면 true를 반환한다
        it('returns true for a matching password', async () => {
            const isMatch = await service.validate('password', hashedPassword)

            expect(isMatch).toBe(true)
        })

        // 일치하지 않는 비밀번호면 false를 반환한다
        it('returns false for a non-matching password', async () => {
            const isMatch = await service.validate('wrongpassword', hashedPassword)

            expect(isMatch).toBe(false)
        })
    })
})
