import { createAppTestContext, AppTestContext } from 'apps/__tests__/__helpers__'
import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtAuthGuard, CustomersHttpController } from 'apps/gateway'

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
