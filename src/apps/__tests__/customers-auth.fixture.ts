import { CustomerDto, CustomersService } from 'cores'
import { createCustomer } from './customers.fixture'
import { createAllTestContexts, AllTestContexts } from './utils'

export interface Fixture {
    testContext: AllTestContexts
    password: string
    customer: CustomerDto
}

export async function createFixture() {
    const testContext = await createAllTestContexts()
    const module = testContext.coresContext.module
    const customersService = module.get(CustomersService)
    const email = 'user@mail.com'
    const password = 'password'
    const customer = await createCustomer(customersService, { email, password })

    return { testContext, password, customer }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export async function createCustomerAndLogin(customersService: CustomersService) {
    const email = 'user@mail.com'
    const password = 'password'
    const customer = await createCustomer(customersService, { email, password })

    const authTokens = await customersService.login(customer.id, email)
    const accessToken = authTokens.accessToken

    return { customer, accessToken }
}
