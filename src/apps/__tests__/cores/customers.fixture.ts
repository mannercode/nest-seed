import { CustomerDto, CustomersClient, CustomersModule } from 'apps/cores'
import { CustomerJwtAuthGuard, CustomersController } from 'apps/gateway'
import { createCustomer2, HttpTestFixture, setupHttpTestContext } from '../__helpers__'

export interface CustomersFixture extends HttpTestFixture {
    createdCustomer: CustomerDto
}

export const createFixture = async () => {
    const context = await setupHttpTestContext({
        imports: [CustomersModule],
        providers: [CustomersClient],
        controllers: [CustomersController],
        ignoreGuards: [CustomerJwtAuthGuard]
    })

    const createdCustomer = await createCustomer2(context, { email: 'user@mail.com' })

    return { ...context, createdCustomer }
}
