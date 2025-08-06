import { CustomerDto } from 'apps/cores'
import { TestContext } from 'testlib'
import { TestFixture } from '../setup-http-test-context'

export const buildCreateCustomerDto = (overrides = {}) => {
    const createDto = {
        name: 'name',
        email: 'name@mail.com',
        birthDate: new Date(0),
        password: 'password',
        ...overrides
    }

    return createDto
}

export const createCustomerAndLogin2 = async (ctx: TestFixture) => {
    const email = 'user@mail.com'
    const password = 'password'
    const customer = await createCustomer2(ctx, { email, password })

    const { accessToken, refreshToken } = await generateAuthTokens2(ctx, customer)

    return { customer, accessToken, refreshToken }
}

export const createCustomer2 = async ({ module }: TestContext, override = {}) => {
    const { CustomersClient } = await import('apps/cores')
    const customersService = module.get(CustomersClient)

    const createDto = buildCreateCustomerDto(override)

    const customer = await customersService.createCustomer(createDto)
    return customer
}

export const generateAuthTokens2 = async ({ module }: TestContext, customer: CustomerDto) => {
    const { CustomersClient } = await import('apps/cores')
    const customersService = module.get(CustomersClient)

    return customersService.generateAuthTokens({ customerId: customer.id, email: customer.email })
}
