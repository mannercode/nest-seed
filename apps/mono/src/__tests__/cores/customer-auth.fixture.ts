import {
    CustomerJwtAuthGuard,
    CustomerLocalAuthGuard,
    CustomerOptionalJwtAuthGuard,
    CustomersHttpController
} from 'controllers'
import { CustomersModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type CustomerAuthFixture = AppTestContext & {}

export async function createCustomerAuthFixture() {
    const ctx = await createAppTestContext({
        controllers: [CustomersHttpController],
        imports: [CustomersModule],
        providers: [CustomerJwtAuthGuard, CustomerLocalAuthGuard, CustomerOptionalJwtAuthGuard]
    })

    return { ...ctx }
}
