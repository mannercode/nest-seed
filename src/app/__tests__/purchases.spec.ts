import { CustomerDto, PurchaseDto, TicketDto } from 'services/core'
import { HttpTestClient } from 'testlib'
import { closeFixture, createFixture, createPurchase, Fixture } from './purchases.fixture'

describe('Purchases Module', () => {
    let fixture: Fixture
    let client: HttpTestClient
    let customer: CustomerDto
    let tickets: TicketDto[]

    beforeEach(async () => {
        fixture = await createFixture()
        client = fixture.testContext.client
        customer = fixture.customer
        tickets = fixture.tickets
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    describe('POST /purchases', () => {
        it('구매 요청을 성공적으로 처리해야 한다', async () => {
            const customerId = customer.id
            const totalPrice = 1000
            const items = tickets.map((ticket) => ({ type: 'ticket', ticketId: ticket.id }))

            await client
                .post('/purchases')
                .body({ customerId, totalPrice, items })
                .created({
                    id: expect.any(String),
                    paymentId: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                    customerId,
                    totalPrice,
                    items
                })
        })
    })

    describe('GET /purchases/:purchaseId', () => {
        let purchase: PurchaseDto

        beforeEach(async () => {
            purchase = await createPurchase(fixture.purchasesService, {})
        })

        it('구매 정보를 조회해야 한다', async () => {
            await client.get(`/purchases/${purchase.id}`).ok(purchase)
        })

        it('결제 정보를 조회해야 한다', async () => {
            const payment = await fixture.paymentsService.getPayment(purchase.paymentId)
            expect(payment.amount).toEqual(purchase.totalPrice)
        })
    })
})
