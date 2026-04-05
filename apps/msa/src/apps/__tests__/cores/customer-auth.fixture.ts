import { createAppTestContext, AppTestContext } from 'apps/__tests__/__helpers__'
import { CustomersClient, CustomersModule } from 'apps/cores'
import {
    CustomerJwtAuthGuard,
    CustomerLocalAuthGuard,
    CustomerOptionalJwtAuthGuard,
    CustomersHttpController
} from 'apps/gateway'

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
