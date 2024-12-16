import { AppConfigService } from 'config'
import { CustomersService } from 'services/cores'
import { CustomerDto } from 'types'
import { createCustomer } from './customers.fixture'
import { createTestContext, TestContext } from './test.util'

export interface Fixture {
    testContext: TestContext
    config: AppConfigService
    password: string
    customer: CustomerDto
}

export async function createFixture() {
    const testContext = await createTestContext()
    const config = testContext.module.get(AppConfigService)
    const customersService = testContext.module.get(CustomersService)
    const email = 'user@mail.com'
    const password = 'password'
    const customer = await createCustomer(customersService, { email, password })

    return { testContext, config, password, customer }
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
