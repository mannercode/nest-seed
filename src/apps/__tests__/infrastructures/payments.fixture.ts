import { PaymentsClient, PaymentsModule } from 'apps/infrastructures'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type PaymentsFixture = AppTestContext & { paymentsService: PaymentsClient }

export async function createPaymentsFixture() {
    const ctx = await createAppTestContext({
        imports: [PaymentsModule],
        providers: [PaymentsClient]
    })

    const paymentsService = ctx.module.get(PaymentsClient)

    return { ...ctx, paymentsService }
}
