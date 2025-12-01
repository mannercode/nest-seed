import { CustomerDto, CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtAuthGuard, CustomersController } from 'apps/gateway'
import { createCustomer, TestFixture, createTestFixture } from '../__helpers__'

export type Fixture = TestFixture & { createdCustomer: CustomerDto }

export async function createFixture() {
    const fix = await createTestFixture({
        imports: [CustomersModule],
        providers: [CustomersClient],
        controllers: [CustomersController],
        ignoreGuards: [CustomerJwtAuthGuard]
    })

    const createdCustomer = await createCustomer(fix, { email: 'user@mail.com' })

    return { ...fix, createdCustomer }
}
