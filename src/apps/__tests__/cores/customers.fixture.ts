import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtAuthGuard, CustomersController } from 'apps/gateway'
import { createTestFixture, TestFixture } from '../__helpers__'

export type CustomersFixture = TestFixture & {}

export async function createCustomersFixture() {
    const fix = await createTestFixture({
        imports: [CustomersModule],
        providers: [CustomersClient],
        controllers: [CustomersController],
        ignoreGuards: [CustomerJwtAuthGuard]
    })

    return fix
}
