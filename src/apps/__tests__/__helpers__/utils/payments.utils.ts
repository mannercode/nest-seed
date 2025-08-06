import { CreatePaymentDto } from 'apps/infrastructures'
import { oid, TestContext } from 'testlib'
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

export const createPayment2 = async (
    { module }: TestContext,
    override: Partial<CreatePaymentDto> = {}
) => {
    const { PaymentsClient } = await import('apps/infrastructures')
    const paymentsService = module.get(PaymentsClient)

    const createDto = buildCreatePaymentDto(override)

    const payment = await paymentsService.createPayment(createDto)
    return payment
}

export const getPayments2 = async ({ module }: TestContext, paymentIds: string[]) => {
    const { PaymentsClient } = await import('apps/infrastructures')
    const paymentsService = module.get(PaymentsClient)

    return paymentsService.getPayments(paymentIds)
}
