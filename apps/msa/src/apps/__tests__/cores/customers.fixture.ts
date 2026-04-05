import { CustomersClient, CustomersModule } from 'cores'
import { CustomerJwtAuthGuard, CustomersHttpController } from 'gateway'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type CustomersFixture = AppTestContext & {}

export async function createCustomersFixture() {
    const ctx = await createAppTestContext({
        controllers: [CustomersHttpController],
        ignoreGuards: [CustomerJwtAuthGuard],
        imports: [CustomersModule],
        providers: [CustomersClient]
    })

    return ctx
}
