import { CustomerAuthenticationService } from '..'

describe('CustomerAuthenticationService', () => {
    let service: CustomerAuthenticationService

    beforeEach(() => {
        service = new CustomerAuthenticationService({} as any, {} as any)
    })

    describe('hash', () => {
        it('returns hashed password', async () => {
            const hashedPassword = await service.hash('password')

            expect(hashedPassword).not.toEqual('password')
        })

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

        it('returns true for a matching password', async () => {
            const isMatch = await service.validate('password', hashedPassword)

            expect(isMatch).toBe(true)
        })

        it('returns false for a non-matching password', async () => {
            const isMatch = await service.validate('wrongpassword', hashedPassword)

            expect(isMatch).toBe(false)
        })
    })
})
