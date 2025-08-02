import { CreatePaymentDto } from 'apps/infrastructures'
import { oid } from 'testlib'
import { CommonFixture } from '../create-common-fixture'

export const buildCreatePaymentDto = (overrides = {}) => {
    const createDto = { customerId: oid(0x0), amount: 1, ...overrides }

    return createDto
}

export const createPayment = async (
    fix: CommonFixture,
    override: Partial<CreatePaymentDto> = {}
) => {
    const createDto = buildCreatePaymentDto(override)

    const payment = await fix.paymentsService.createPayment(createDto)
    return payment
}

export const getPayments = async (fix: CommonFixture, paymentIds: string[]) => {
    return fix.paymentsService.getPayments(paymentIds)
}
