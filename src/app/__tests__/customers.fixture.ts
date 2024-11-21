import { omit } from 'lodash'
import { CustomersService } from 'services/customers'
import { createHttpTestContext, HttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'
import { CustomerJwtAuthGuard } from '../controllers/guards'

export interface Fixture {
    testContext: HttpTestContext
    customersService: CustomersService
}

export async function createFixture() {
    const testContext = await createHttpTestContext(
        { imports: [AppModule], ignoreGuards: [CustomerJwtAuthGuard] },
        configureApp
    )
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

    const expectedDto = { id: expect.anything(), ...omit(createDto, 'password') }

    return { createDto, expectedDto }
}

export const createCustomer = async (customersService: CustomersService, override = {}) => {
    const { createDto } = createCustomerDto(override)
    const customer = customersService.createCustomer(createDto)
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
