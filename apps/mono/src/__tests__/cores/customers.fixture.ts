import { CustomerJwtAuthGuard, CustomersHttpController } from 'controllers'
import { CustomersModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type CustomersFixture = AppTestContext & {}

export async function createCustomersFixture() {
    const ctx = await createAppTestContext({
        controllers: [CustomersHttpController],
        ignoreGuards: [CustomerJwtAuthGuard],
        imports: [CustomersModule]
    })

    return ctx
}
