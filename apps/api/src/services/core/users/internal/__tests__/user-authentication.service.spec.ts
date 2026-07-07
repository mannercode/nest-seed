import { ensure } from '@mannercode/common'
import { UserAuthenticationService } from '..'

describe('UserAuthenticationService', () => {
    let service: UserAuthenticationService

    beforeEach(() => {
        service = new UserAuthenticationService({} as any, {} as any)
    })

    describe('hash', () => {
        it('해시된 비밀번호를 반환한다', async () => {
            const hashedPassword = await service.hash('password')

            expect(hashedPassword).not.toEqual('password')
        })

        it('같은 비밀번호라도 매번 다른 해시를 반환한다', async () => {
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

        it('일치하는 비밀번호이면 true를 반환한다', async () => {
            const isMatch = await service.validate('password', hashedPassword)

            expect(isMatch).toBe(true)
        })

        it('일치하지 않는 비밀번호이면 false를 반환한다', async () => {
            const isMatch = await service.validate('wrongpassword', hashedPassword)

            expect(isMatch).toBe(false)
        })
    })

    describe('findUserByCredentials', () => {
        it('가입된 이메일이 없으면 더미 해시로 validate를 호출하고 null을 반환한다', async () => {
            const repo = { findByEmailWithPassword: jest.fn().mockResolvedValue(null) }
            const svc = new UserAuthenticationService(repo as any, {} as any)
            const validateSpy = jest.spyOn(svc, 'validate')

            const result = await svc.findUserByCredentials({
                email: 'noone@x.com',
                password: 'anything'
            })

            expect(result).toBeNull()
            expect(validateSpy).toHaveBeenCalledTimes(1)
            // 가입 여부에 따른 응답 시간 차이를 없애기 위해 사용자가 없어도 bcrypt 형식 더미 해시와 비교한다.
            const [, hashArg] = ensure(validateSpy.mock.calls[0])
            expect(typeof hashArg).toBe('string')
            expect(hashArg.startsWith('$2')).toBe(true)
        })

        it('비밀번호가 일치하지 않으면 저장된 해시로 validate를 호출하고 null을 반환한다', async () => {
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
            expect(ensure(validateSpy.mock.calls[0])[1]).toBe(realHash)
        })
    })
})
