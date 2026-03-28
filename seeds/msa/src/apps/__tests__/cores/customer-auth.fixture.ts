import type { AppTestContext } from 'apps/__tests__/__helpers__'
import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtStrategy, CustomerLocalStrategy, CustomersHttpController } from 'apps/gateway'

export type CustomerAuthFixture = AppTestContext & {}

export async function createCustomerAuthFixture() {
    const ctx = await createAppTestContext({
        controllers: [CustomersHttpController],
        imports: [CustomersModule],
        providers: [CustomersClient, CustomerLocalStrategy, CustomerJwtStrategy]
    })

    return { ...ctx }
}
