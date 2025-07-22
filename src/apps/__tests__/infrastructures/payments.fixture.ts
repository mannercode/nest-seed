import { nullObjectId } from 'testlib'
import { CommonFixture, createCommonFixture } from '../__helpers__'

export const buildCreatePaymentDto = (overrides = {}) => {
    const createDto = { customerId: nullObjectId, amount: 1, ...overrides }

    const expectedDto = {
        ...createDto,
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
    }

    return { createDto, expectedDto }
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown }
}
