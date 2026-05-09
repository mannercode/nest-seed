import { PaymentsService } from 'infrastructure'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type PaymentsFixture = AppTestContext & { paymentsService: PaymentsService }

export async function createPaymentsFixture() {
    const ctx = await createAppTestContext()

    const paymentsService = ctx.module.get(PaymentsService)

    return { ...ctx, paymentsService }
}
