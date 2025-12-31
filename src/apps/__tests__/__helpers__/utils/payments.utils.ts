import { oid } from 'testlib'
import type { CreatePaymentDto } from 'apps/infrastructures'
import type { TestContext } from 'testlib'

export function buildCreatePaymentDto(overrides = {}) {
    const createDto = { customerId: oid(0x0), amount: 1, ...overrides }

    return createDto
}

export async function createPayment(ctx: TestContext, override: Partial<CreatePaymentDto> = {}) {
    const { PaymentsService } = await import('apps/infrastructures')
    const paymentsService = ctx.module.get(PaymentsService)

    const createDto = buildCreatePaymentDto(override)

    const payment = await paymentsService.create(createDto)
    return payment
}

export async function getPayments(ctx: TestContext, paymentIds: string[]) {
    const { PaymentsService } = await import('apps/infrastructures')
    const paymentsService = ctx.module.get(PaymentsService)

    return paymentsService.getMany(paymentIds)
}
