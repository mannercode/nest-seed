import { omit } from 'lodash'
import { createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'
import { CustomerJwtAuthGuard } from '../controllers/guards'

export interface IsolatedFixture {
    testContext: HttpTestContext
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext(
        {
            imports: [AppModule],
            ignoreGuards: [CustomerJwtAuthGuard]
        },
        configureApp
    )

    return { testContext }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
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

export const createCustomer = async (client: HttpTestClient, override = {}) => {
    const { createDto } = createCustomerDto(override)

    const { body } = await client.post('/customers').body(createDto).created()
    return body
}

export const createCustomers = async (
    client: HttpTestClient,
    length: number = 20,
    overrides = {}
) => {
    return Promise.all(
        Array.from({ length }, async (_, index) =>
            createCustomer(client, {
                name: `Customer-${index}`,
                email: `user-${index}@mail.com`,
                ...overrides
            })
        )
    )
}
