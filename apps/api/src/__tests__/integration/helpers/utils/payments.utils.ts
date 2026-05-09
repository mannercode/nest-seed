import type { CreatePaymentDto } from 'infrastructure'
import { oid, type TestContext } from '@mannercode/testing'

export function buildCreatePaymentDto(overrides: Partial<CreatePaymentDto> = {}): CreatePaymentDto {
    return { amount: 1, userId: oid(0x0), ...overrides }
}

export async function createPayment(ctx: TestContext, override: Partial<CreatePaymentDto> = {}) {
    const { PaymentsService } = await import('infrastructure')
    const paymentsService = ctx.module.get(PaymentsService)

    const createDto = buildCreatePaymentDto(override)

    const payment = await paymentsService.create(createDto)
    return payment
}

export async function getPayments(ctx: TestContext, paymentIds: string[]) {
    const { PaymentsService } = await import('infrastructure')
    const paymentsService = ctx.module.get(PaymentsService)

    return paymentsService.getMany(paymentIds)
}
