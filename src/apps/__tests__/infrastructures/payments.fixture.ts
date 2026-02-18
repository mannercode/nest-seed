import type { AppTestContext } from 'apps/__tests__/__helpers__'
import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { PaymentsClient, PaymentsModule } from 'apps/infrastructures'

export type PaymentsFixture = AppTestContext & { paymentsClient: PaymentsClient }

export async function createPaymentsFixture() {
    const ctx = await createAppTestContext({
        imports: [PaymentsModule],
        providers: [PaymentsClient]
    })

    const paymentsClient = ctx.module.get(PaymentsClient)

    return { ...ctx, paymentsClient }
}
