import { CustomerDto } from 'apps/cores'
import { JwtAuthTokens } from 'common'
import { CommonFixture, createCommonFixture } from '../__helpers__'
import { createCustomer } from '../common.fixture'

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
    const commonFixture = await createCommonFixture()

    const credentials = { email: 'user@mail.com', password: 'password' }

    const customer = await createCustomer(commonFixture, credentials)

    const authTokens = await generateAuthTokens(commonFixture, customer)

    const teardown = async () => {
        await commonFixture?.close()
    }

    return { ...commonFixture, teardown, credentials, authTokens }
}
