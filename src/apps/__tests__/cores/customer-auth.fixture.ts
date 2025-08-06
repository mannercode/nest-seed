import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtStrategy, CustomerLocalStrategy, CustomersController } from 'apps/gateway'
import { JwtAuthTokens } from 'common'
import {
    createCustomer2,
    generateAuthTokens2,
    HttpTestFixture,
    setupHttpTestContext
} from '../__helpers__'

export interface Fixture extends HttpTestFixture {
    credentials: { email: string; password: string }
    authTokens: JwtAuthTokens
}

export const createFixture = async () => {
    const context = await setupHttpTestContext({
        imports: [CustomersModule],
        providers: [CustomersClient, CustomerLocalStrategy, CustomerJwtStrategy],
        controllers: [CustomersController]
    })

    const credentials = { email: 'user@mail.com', password: 'password' }
    const customer = await createCustomer2(context, credentials)
    const authTokens = await generateAuthTokens2(context, customer)

    return { ...context, credentials, authTokens }
}
