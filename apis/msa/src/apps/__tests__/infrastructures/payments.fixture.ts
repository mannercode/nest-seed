import { PaymentsClient, PaymentsModule } from 'infrastructures'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type PaymentsFixture = AppTestContext & { paymentsClient: PaymentsClient }

export async function createPaymentsFixture() {
    const ctx = await createAppTestContext({
        imports: [PaymentsModule],
        providers: [PaymentsClient]
    })

    const paymentsClient = ctx.module.get(PaymentsClient)

    return { ...ctx, paymentsClient }
}
