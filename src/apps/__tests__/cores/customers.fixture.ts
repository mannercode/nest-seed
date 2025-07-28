import { CustomerDto } from 'apps/cores'
import { CustomerJwtAuthGuard } from 'apps/gateway'
import { createCustomer } from '../__fixtures__'
import { CommonFixture, createCommonFixture } from '../__helpers__'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    customer: CustomerDto
}

export const createFixture = async () => {
    const fix = await createCommonFixture({
        gateway: { ignoreGuards: [CustomerJwtAuthGuard] }
    })

    const customer = await createCustomer(fix, { email: 'user@mail.com' })

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown, customer }
}
