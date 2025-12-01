import { CreatePaymentDto } from 'apps/infrastructures'
import { oid, TestContext } from 'testlib'

export function buildCreatePaymentDto(overrides = {}) {
    const createDto = { customerId: oid(0x0), amount: 1, ...overrides }

    return createDto
}

export async function createPayment(
    { module }: TestContext,
    override: Partial<CreatePaymentDto> = {}
) {
    const { PaymentsClient } = await import('apps/infrastructures')
    const paymentsService = module.get(PaymentsClient)

    const createDto = buildCreatePaymentDto(override)

    const payment = await paymentsService.create(createDto)
    return payment
}

export async function getPayments({ module }: TestContext, paymentIds: string[]) {
    const { PaymentsClient } = await import('apps/infrastructures')
    const paymentsService = module.get(PaymentsClient)

    return paymentsService.getMany(paymentIds)
}
