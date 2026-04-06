import { CustomersClient, CustomersModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type CustomerAuthFixture = AppTestContext & {}

export async function createCustomerAuthFixture() {
    const ctx = await createAppTestContext({
        imports: [CustomersModule],
        providers: [CustomersClient]
    })

    return { ...ctx }
}
