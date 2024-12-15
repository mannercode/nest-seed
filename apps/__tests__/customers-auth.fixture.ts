import { AppModule } from 'app/app.module'
import { configureApp } from 'app/main'
import { AppConfigService } from 'config'
import { CustomerDto, CustomersService } from 'services/cores'
import { createHttpTestContext, HttpTestContext } from 'testlib'
import { createCustomer } from './customers.fixture'

export interface Fixture {
    testContext: HttpTestContext
    config: AppConfigService
    password: string
    customer: CustomerDto
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
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
