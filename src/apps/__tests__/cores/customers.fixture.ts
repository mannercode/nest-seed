import { CustomerDto } from 'apps/cores'
import { CustomerJwtAuthGuard } from 'apps/gateway'
import { CommonFixture, createCommonFixture, createCustomer } from '../__helpers__'

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
