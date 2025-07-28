import { CommonFixture } from '../__helpers__'

export const getPayments = async (fix: CommonFixture, paymentIds: string[]) => {
    return fix.paymentsService.getPayments(paymentIds)
}
