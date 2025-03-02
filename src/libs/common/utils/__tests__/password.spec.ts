import { Password } from 'common'

describe('Password', () => {
    it('비밀번호를 해싱해야 한다', async () => {
        const password = 'password'
        const hashedPassword = await Password.hash(password)

        expect(hashedPassword).not.toEqual(password)
    })

    it('비밀번호가 일치하면 true를 반환해야 한다', async () => {
        const password = 'password'
        const hashedPassword = await Password.hash(password)

        const isValidPassword = await Password.validate(password, hashedPassword)

        expect(isValidPassword).toBeTruthy()
    })

    it('비밀번호가 일치하지 않으면 false를 반환해야 한다', async () => {
        const password = 'password'
        const hashedPassword = await Password.hash(password)

        const isValidPassword = await Password.validate('wrongpassword', hashedPassword)

        expect(isValidPassword).toBeFalsy()
    })
})
