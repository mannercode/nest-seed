import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtStrategy, CustomerLocalStrategy, CustomersController } from 'apps/gateway'
import { createCustomer, createAppTestContext, TestFixture } from '../__helpers__'

export type CustomerAuthFixture = TestFixture & { credentials: { email: string; password: string } }

export async function createCustomerAuthFixture() {
    const fix = await createAppTestContext({
        imports: [CustomersModule],
        providers: [CustomersClient, CustomerLocalStrategy, CustomerJwtStrategy],
        controllers: [CustomersController]
    })

    const credentials = { email: 'user@mail.com', password: 'password' }
    await createCustomer(fix, credentials)

    return { ...fix, credentials }
}
