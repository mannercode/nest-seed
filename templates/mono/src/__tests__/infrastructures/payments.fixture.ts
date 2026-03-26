import { PaymentsModule, PaymentsService } from 'infrastructures'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type PaymentsFixture = AppTestContext & { paymentsService: PaymentsService }

export async function createPaymentsFixture() {
    const ctx = await createAppTestContext({ imports: [PaymentsModule] })

    const paymentsService = ctx.module.get(PaymentsService)

    return { ...ctx, paymentsService }
}
