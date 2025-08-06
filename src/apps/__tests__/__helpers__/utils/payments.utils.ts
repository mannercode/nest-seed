import { CreatePaymentDto } from 'apps/infrastructures'
import { oid, TestContext } from 'testlib'

export const buildCreatePaymentDto = (overrides = {}) => {
    const createDto = { customerId: oid(0x0), amount: 1, ...overrides }

    return createDto
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
