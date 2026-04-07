import { CustomerJwtAuthGuard, CustomersModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type CustomersFixture = AppTestContext & {}

export async function createCustomersFixture() {
    const ctx = await createAppTestContext({
        ignoreGuards: [CustomerJwtAuthGuard],
        imports: [CustomersModule]
    })

    return ctx
}
