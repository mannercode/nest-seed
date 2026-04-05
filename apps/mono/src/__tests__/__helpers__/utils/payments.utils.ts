import type { CreatePaymentDto } from 'infrastructures'
import { oid, TestContext } from '@mannercode/testing'

export function buildCreatePaymentDto(overrides = {}) {
    const createDto = { amount: 1, customerId: oid(0x0), ...overrides }

    return createDto
}

export async function createPayment(ctx: TestContext, override: Partial<CreatePaymentDto> = {}) {
    const { PaymentsService } = await import('infrastructures')
    const paymentsService = ctx.module.get(PaymentsService)

    const createDto = buildCreatePaymentDto(override)

    const payment = await paymentsService.create(createDto)
    return payment
}

export async function getPayments(ctx: TestContext, paymentIds: string[]) {
    const { PaymentsService } = await import('infrastructures')
    const paymentsService = ctx.module.get(PaymentsService)

    return paymentsService.getMany(paymentIds)
}
