import { CustomerDto } from 'apps/cores'
import { CustomerJwtAuthGuard } from 'apps/gateway'
import { CommonFixture, createCommonFixture } from '../__helpers__'
import { createCustomer } from '../common.fixture'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    customer: CustomerDto
}

export const createFixture = async () => {
    const commonFixture = await createCommonFixture({
        gateway: { ignoreGuards: [CustomerJwtAuthGuard] }
    })

    const customer = await createCustomer(commonFixture, { email: 'user@mail.com' })

    const teardown = async () => {
        await commonFixture?.close()
    }

    return { ...commonFixture, teardown, customer }
}
