import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtAuthGuard, CustomersController } from 'apps/gateway'
import { createAppTestContext } from '../__helpers__'
import type { AppTestContext } from '../__helpers__'

export type CustomersFixture = AppTestContext & {}

export async function createCustomersFixture() {
    const ctx = await createAppTestContext({
        imports: [CustomersModule],
        providers: [CustomersClient],
        controllers: [CustomersController],
        ignoreGuards: [CustomerJwtAuthGuard]
    })

    return ctx
}
