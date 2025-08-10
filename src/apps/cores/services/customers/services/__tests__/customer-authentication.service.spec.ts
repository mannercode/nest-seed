import { CustomerAuthenticationService } from '..'

describe('CustomerAuthenticationService', () => {
    let service: CustomerAuthenticationService

    beforeEach(() => {
        service = new CustomerAuthenticationService({} as any, {} as any)
    })

    describe('hash', () => {
        // 비밀번호의 해시 값을 반환한다
        it('returns the hashed password', async () => {
            const hashedPassword = await service.hash('password')

            expect(hashedPassword).not.toEqual('password')
        })

        // 같은 비밀번호에 대해서 서로 다른 해시 값을 반환한다
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

        // 비밀번호가 일치하는 경우 true를 반환한다
        it('returns true when the password matches', async () => {
            const isMatch = await service.validate('password', hashedPassword)

            expect(isMatch).toBe(true)
        })

        // 비밀번호가 일치하지 않는 경우 false를 반환한다
        it('returns false when the password does not match', async () => {
            const isMatch = await service.validate('wrongpassword', hashedPassword)

            expect(isMatch).toBe(false)
        })
    })
})
