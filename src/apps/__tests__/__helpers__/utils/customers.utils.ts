import { CustomerDto } from 'apps/cores'
import { TestContext } from 'testlib'
import { CommonFixture } from '../create-common-fixture'

export const createCustomerAndLogin = async (fix: CommonFixture) => {
    const email = 'user@mail.com'
    const password = 'password'
    const customer = await createCustomer(fix, { email, password })

    const { accessToken, refreshToken } = await generateAuthTokens(fix, customer)

    return { customer, accessToken, refreshToken }
}

export const generateAuthTokens = async (fix: CommonFixture, customer: CustomerDto) => {
    return fix.customersService.generateAuthTokens({
        customerId: customer.id,
        email: customer.email
    })
}

export const createCustomer = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateCustomerDto(override)

    const customer = await fix.customersService.createCustomer(createDto)
    return customer
}

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

export const createCustomerAndLogin2 = async (ctx: TestContext) => {
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
