import { PaymentsClient, PaymentsModule } from 'apps/infrastructures'
import { createAppTestContext } from '../__helpers__'
import type { AppTestContext } from '../__helpers__'

export type PaymentsFixture = AppTestContext & { paymentsClient: PaymentsClient }

export async function createPaymentsFixture() {
    const ctx = await createAppTestContext({
        imports: [PaymentsModule],
        providers: [PaymentsClient]
    })

    const paymentsClient = ctx.module.get(PaymentsClient)

    return { ...ctx, paymentsClient }
}
