import { PaymentsClient, PaymentsModule } from 'apps/infrastructures'
import { createAppTestContext, TestFixture } from '../__helpers__'

export type PaymentsFixture = TestFixture & { paymentsService: PaymentsClient }

export async function createPaymentsFixture() {
    const fix = await createAppTestContext({
        imports: [PaymentsModule],
        providers: [PaymentsClient]
    })

    const paymentsService = fix.module.get(PaymentsClient)

    return { ...fix, paymentsService }
}
