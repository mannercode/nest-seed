import { JwtAuthTokens } from 'common'
import { createCustomer, generateAuthTokens } from '../__fixtures__'
import { CommonFixture, createCommonFixture } from '../__helpers__'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    credentials: { email: string; password: string }
    authTokens: JwtAuthTokens
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const credentials = { email: 'user@mail.com', password: 'password' }

    const customer = await createCustomer(fix, credentials)

    const authTokens = await generateAuthTokens(fix, customer)

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown, credentials, authTokens }
}
