import { CommonFixture, createCommonFixture } from '../__helpers__'
import { createCustomer } from '../common.fixture'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    credentials: { email: string; password: string }
}

export const createFixture = async () => {
    const commonFixture = await createCommonFixture()

    const credentials = { email: 'user@mail.com', password: 'password' }

    await createCustomer(commonFixture, credentials)

    const teardown = async () => {
        await commonFixture?.close()
    }

    return { ...commonFixture, teardown, credentials }
}
