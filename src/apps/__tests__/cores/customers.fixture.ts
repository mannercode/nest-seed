import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtAuthGuard, CustomersController } from 'apps/gateway'
import { createAppTestContext, TestFixture } from '../__helpers__'

export type CustomersFixture = TestFixture & {}

export async function createCustomersFixture() {
    const fix = await createAppTestContext({
        imports: [CustomersModule],
        providers: [CustomersClient],
        controllers: [CustomersController],
        ignoreGuards: [CustomerJwtAuthGuard]
    })

    return fix
}
