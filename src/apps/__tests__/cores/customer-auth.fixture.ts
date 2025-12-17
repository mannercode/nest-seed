import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtStrategy, CustomerLocalStrategy, CustomersController } from 'apps/gateway'
import type { AppTestContext } from '../__helpers__'
import { createCustomer, createAppTestContext } from '../__helpers__'

export type CustomerAuthFixture = AppTestContext & {
    credentials: { email: string; password: string }
}

export async function createCustomerAuthFixture() {
    const ctx = await createAppTestContext({
        imports: [CustomersModule],
        providers: [CustomersClient, CustomerLocalStrategy, CustomerJwtStrategy],
        controllers: [CustomersController]
    })

    const credentials = { email: 'user@mail.com', password: 'password' }
    await createCustomer(ctx, credentials)

    return { ...ctx, credentials }
}
