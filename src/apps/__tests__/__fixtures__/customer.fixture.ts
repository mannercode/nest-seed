import { CustomerDto } from 'apps/cores'
import { CommonFixture } from '../__helpers__'

export const createCustomerAndLogin = async (fix: CommonFixture) => {
    const email = 'user@mail.com'
    const password = 'password'
    const customer = await createCustomer(fix, { email, password })

    const { accessToken } = await generateAuthTokens(fix, customer)

    return { customer, accessToken }
}

export const generateAuthTokens = async (fix: CommonFixture, customer: CustomerDto) => {
    return fix.customersService.generateAuthTokens({
        customerId: customer.id,
        email: customer.email
    })
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

export const createCustomer = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateCustomerDto(override)

    const customer = await fix.customersService.createCustomer(createDto)
    return customer
}
