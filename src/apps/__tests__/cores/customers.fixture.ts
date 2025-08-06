import { CustomerDto, CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtAuthGuard, CustomersController } from 'apps/gateway'
import { createCustomer2, TestFixture, createTestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    createdCustomer: CustomerDto
}

export const createFixture = async () => {
    const fix = await createTestFixture({
        imports: [CustomersModule],
        providers: [CustomersClient],
        controllers: [CustomersController],
        ignoreGuards: [CustomerJwtAuthGuard]
    })

    const createdCustomer = await createCustomer2(fix, { email: 'user@mail.com' })

    return { ...fix, createdCustomer }
}
