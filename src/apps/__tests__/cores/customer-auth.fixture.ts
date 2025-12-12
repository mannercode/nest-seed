import { CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtStrategy, CustomerLocalStrategy, CustomersController } from 'apps/gateway'
import { createTestFixture, TestFixture } from '../__helpers__'

export type CustomerAuthFixture = TestFixture & {}

export async function createCustomerAuthFixture() {
    const fix = await createTestFixture({
        imports: [CustomersModule],
        providers: [CustomersClient, CustomerLocalStrategy, CustomerJwtStrategy],
        controllers: [CustomersController]
    })

    return fix
}
