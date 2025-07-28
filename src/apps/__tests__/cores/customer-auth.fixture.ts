import { CustomerDto } from 'apps/cores'
import { JwtAuthTokens } from 'common'
import { createCustomer } from '../__fixtures__'
import { CommonFixture, createCommonFixture } from '../__helpers__'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    credentials: { email: string; password: string }
    authTokens: JwtAuthTokens
}

export const generateAuthTokens = async (fix: CommonFixture, customer: CustomerDto) => {
    return fix.customersService.generateAuthTokens({
        customerId: customer.id,
        email: customer.email
    })
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
