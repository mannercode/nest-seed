import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtStrategy, CustomerLocalStrategy, CustomersController } from 'apps/gateway'
import { JwtAuthTokens } from 'common'
import {
    createCustomer2,
    generateAuthTokens2,
    TestFixture,
    createTestFixture
} from '../__helpers__'

export interface Fixture extends TestFixture {
    credentials: { email: string; password: string }
    authTokens: JwtAuthTokens
}

export const createFixture = async () => {
    const fix = await createTestFixture({
        imports: [CustomersModule],
        providers: [CustomersClient, CustomerLocalStrategy, CustomerJwtStrategy],
        controllers: [CustomersController]
    })

    const credentials = { email: 'user@mail.com', password: 'password' }
    const customer = await createCustomer2(fix, credentials)
    const authTokens = await generateAuthTokens2(fix, customer)

    return { ...fix, credentials, authTokens }
}
