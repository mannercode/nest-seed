import { UserAuthenticationService } from '..'

describe('UserAuthenticationService', () => {
    let service: UserAuthenticationService

    beforeEach(() => {
        service = new UserAuthenticationService({} as any, {} as any)
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

    describe('findUserByCredentials timing equalization', () => {
        // 사용자가 없어도 validate (= bcrypt.compare) 가 호출되어 시간이 평탄화된다
        it('runs validate even when the email is not registered', async () => {
            const repo = { findByEmailWithPassword: jest.fn().mockResolvedValue(null) }
            const svc = new UserAuthenticationService(repo as any, {} as any)
            const validateSpy = jest.spyOn(svc, 'validate')

            const result = await svc.findUserByCredentials({
                email: 'noone@x.com',
                password: 'anything'
            })

            expect(result).toBeNull()
            expect(validateSpy).toHaveBeenCalledTimes(1)
            // 더미 해시와 비교했어야 함 (= bcrypt 형식의 해시이지만 사용자 실해시는 아님)
            const [, hashArg] = validateSpy.mock.calls[0]
            expect(typeof hashArg).toBe('string')
            expect(hashArg.startsWith('$2')).toBe(true)
        })

        // 사용자가 있고 비번이 틀려도 null 반환 (실해시와 비교됨)
        it('returns null and runs validate for an existing user with wrong password', async () => {
            const realHash = await service.hash('correct')
            const repo = {
                findByEmailWithPassword: jest
                    .fn()
                    .mockResolvedValue({ id: 'u1', email: 'a@b.com', password: realHash })
            }
            const svc = new UserAuthenticationService(repo as any, {} as any)
            const validateSpy = jest.spyOn(svc, 'validate')

            const result = await svc.findUserByCredentials({ email: 'a@b.com', password: 'wrong' })

            expect(result).toBeNull()
            expect(validateSpy).toHaveBeenCalledTimes(1)
            expect(validateSpy.mock.calls[0][1]).toBe(realHash)
        })
    })
})
