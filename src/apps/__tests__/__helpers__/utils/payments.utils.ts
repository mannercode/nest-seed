import type { CreatePaymentDto } from 'apps/infrastructures'
import type { TestContext } from 'testlib'
import { oid } from 'testlib'

export function buildCreatePaymentDto(overrides = {}) {
    const createDto = { customerId: oid(0x0), amount: 1, ...overrides }

    return createDto
}

export async function createPayment(ctx: TestContext, override: Partial<CreatePaymentDto> = {}) {
    const { PaymentsClient } = await import('apps/infrastructures')
    const paymentsService = ctx.module.get(PaymentsClient)

    const createDto = buildCreatePaymentDto(override)

    const payment = await paymentsService.create(createDto)
    return payment
}

export async function getPayments(ctx: TestContext, paymentIds: string[]) {
    const { PaymentsClient } = await import('apps/infrastructures')
    const paymentsService = ctx.module.get(PaymentsClient)

    return paymentsService.getMany(paymentIds)
}
