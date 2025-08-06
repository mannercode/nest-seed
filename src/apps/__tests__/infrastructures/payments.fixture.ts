import { PaymentsClient, PaymentsModule } from 'apps/infrastructures'
import { createTestFixture, TestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    paymentsService: PaymentsClient
}

export const createFixture = async () => {
    const fix = await createTestFixture({ imports: [PaymentsModule], providers: [PaymentsClient] })

    const paymentsService = fix.module.get(PaymentsClient)

    return { ...fix, paymentsService }
}
