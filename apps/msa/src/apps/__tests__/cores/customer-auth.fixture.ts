import { CustomersClient, CustomersModule } from 'cores'
import {
    CustomerJwtAuthGuard,
    CustomerLocalAuthGuard,
    CustomerOptionalJwtAuthGuard,
    CustomersHttpController
} from 'gateway'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type CustomerAuthFixture = AppTestContext & {}

export async function createCustomerAuthFixture() {
    const ctx = await createAppTestContext({
        controllers: [CustomersHttpController],
        imports: [CustomersModule],
        providers: [
            CustomersClient,
            CustomerJwtAuthGuard,
            CustomerLocalAuthGuard,
            CustomerOptionalJwtAuthGuard
        ]
    })

    return { ...ctx }
}
