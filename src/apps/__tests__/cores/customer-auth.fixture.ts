import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtStrategy, CustomerLocalStrategy, CustomersController } from 'apps/gateway'
import type { AppTestContext } from 'apps/__tests__/__helpers__'

export type CustomerAuthFixture = AppTestContext & {}

export async function createCustomerAuthFixture() {
    const ctx = await createAppTestContext({
        imports: [CustomersModule],
        providers: [CustomersClient, CustomerLocalStrategy, CustomerJwtStrategy],
        controllers: [CustomersController]
    })

    return { ...ctx }
}
