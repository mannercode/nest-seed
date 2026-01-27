import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtAuthGuard, CustomersController } from 'apps/gateway'
import type { AppTestContext } from 'apps/__tests__/__helpers__'

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
