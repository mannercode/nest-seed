import { CustomerJwtStrategy, CustomerLocalStrategy, CustomersHttpController } from 'controllers'
import { CustomersModule } from 'cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type CustomerAuthFixture = AppTestContext & {}

export async function createCustomerAuthFixture() {
    const ctx = await createAppTestContext({
        controllers: [CustomersHttpController],
        imports: [CustomersModule],
        providers: [CustomerLocalStrategy, CustomerJwtStrategy]
    })

    return { ...ctx }
}
