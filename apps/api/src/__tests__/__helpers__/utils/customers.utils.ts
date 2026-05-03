import type { TestContext } from '@mannercode/testing'
import type { CreateCustomerDto, CustomerCredentialsDto } from 'cores'

export function buildCreateCustomerDto(
    overrides: Partial<CreateCustomerDto> = {}
): CreateCustomerDto {
    return {
        birthDate: new Date(0),
        email: 'name@mail.com',
        name: 'name',
        password: 'password',
        ...overrides
    }
}

export async function createAndLoginCustomer(ctx: TestContext) {
    const credentials = { email: 'user@mail.com', password: 'password' }

    const customer = await createCustomer(ctx, credentials)

    const { accessToken, refreshToken } = await loginCustomer(ctx, credentials)

    return { accessToken, customer, refreshToken }
}

export async function createCustomer(ctx: TestContext, override: Partial<CreateCustomerDto> = {}) {
    const { CustomersService } = await import('cores')
    const customersService = ctx.module.get(CustomersService)

    const createDto = buildCreateCustomerDto(override)

    const customer = await customersService.create(createDto)
    return customer
}

export async function loginCustomer(ctx: TestContext, credentials: CustomerCredentialsDto) {
    const { CustomersService } = await import('cores')
    const customersService = ctx.module.get(CustomersService)

    const customer = await customersService.findCustomerByCredentials(credentials)
    if (!customer) {
        throw new Error(
            `loginCustomer: no customer found for credentials (email=${credentials.email})`
        )
    }

    const { accessToken, refreshToken } = await customersService.generateAuthTokens({
        customerId: customer.id,
        email: credentials.email
    })

    return { accessToken, customer, refreshToken }
}
