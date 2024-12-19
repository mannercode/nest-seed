import { CustomerJwtAuthGuard } from 'gateway/controllers'
import { omit } from 'lodash'
import { CustomersService } from 'services/cores'
import { createTestContext, TestContext } from './utils'

export interface Fixture {
    testContext: TestContext
    customersService: CustomersService
}

export async function createFixture() {
    const testContext = await createTestContext({ http: { ignoreGuards: [CustomerJwtAuthGuard] } })
    const customersService = testContext.module.get(CustomersService)

    return { testContext, customersService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createCustomerDto = (overrides = {}) => {
    const createDto = {
        name: 'name',
        email: 'name@mail.com',
        birthdate: new Date('2020-12-12'),
        password: 'password',
        ...overrides
    }

    const expectedDto = { id: expect.any(String), ...omit(createDto, 'password') }

    return { createDto, expectedDto }
}

export const createCustomer = async (customersService: CustomersService, override = {}) => {
    const { createDto } = createCustomerDto(override)
    const customer = await customersService.createCustomer(createDto)
    return customer
}

export const createCustomers = async (
    customersService: CustomersService,
    length: number = 20,
    overrides = {}
) => {
    return Promise.all(
        Array.from({ length }, async (_, index) =>
            createCustomer(customersService, {
                name: `Customer-${index}`,
                email: `user-${index}@mail.com`,
                ...overrides
            })
        )
    )
}
