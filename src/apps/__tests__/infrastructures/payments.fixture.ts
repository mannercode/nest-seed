import { PaymentsClient, PaymentsModule } from 'apps/infrastructures'
import { createTestFixture, TestFixture } from '../__helpers__'

export type PaymentsFixture = TestFixture & { paymentsService: PaymentsClient }

export async function createPaymentsFixture() {
    const fix = await createTestFixture({ imports: [PaymentsModule], providers: [PaymentsClient] })

    const paymentsService = fix.module.get(PaymentsClient)

    return { ...fix, paymentsService }
}
