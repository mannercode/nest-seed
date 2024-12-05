import { CustomerDto } from 'services/customers'
import { TicketDto } from 'services/tickets'
import { HttpTestClient } from 'testlib'
import { closeFixture, createFixture, Fixture } from './purchases.fixture'

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
        it('결제 요청을 성공적으로 처리해야 한다', async () => {
            const customerId = customer.id
            const totalPrice = 1000
            const items = tickets.map((ticket) => ({ type: 'ticket', ticketId: ticket.id }))

            await client
                .post('/purchases')
                .body({ customerId, totalPrice, items })
                .created({
                    id: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                    customerId,
                    totalPrice,
                    items
                })
        })
    })
})
