import { CustomerAuthenticationService } from '..'

// TODO
describe('CustomerAuthenticationService', () => {
    let service: CustomerAuthenticationService

    beforeEach(() => {
        const mockRepository = {} as any
        const mockJwtService = {} as any
        service = new CustomerAuthenticationService(mockRepository, mockJwtService)
    })

    // 비밀번호를 해싱해야 한다
    it('Should hash the password', async () => {
        const password = 'password'
        const hashedPassword = await service.hash(password)

        expect(hashedPassword).not.toEqual(password)
    })

    // 같은 비밀번호에 대해서 서로 다른 해시 값을 생성해야 한다
    it('Should generate different hash values for the same password', async () => {
        const password = 'password'
        const firstHash = await service.hash(password)
        const secondHash = await service.hash(password)

        expect(firstHash).not.toEqual(secondHash)
    })

    // 비밀번호가 일치하면 true를 반환해야 한다
    it('Should return true if the password matches', async () => {
        const password = 'password'
        const hashedPassword = await service.hash(password)

        const isValidPassword = await service.validate(password, hashedPassword)

        expect(isValidPassword).toBeTruthy()
    })

    // 비밀번호가 일치하지 않으면 false를 반환해야 한다
    it('Should return false if the password does not match', async () => {
        const password = 'password'
        const hashedPassword = await service.hash(password)

        const isValidPassword = await service.validate('wrongpassword', hashedPassword)

        expect(isValidPassword).toBeFalsy()
    })
})
