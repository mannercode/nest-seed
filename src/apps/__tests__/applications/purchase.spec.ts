import { CreatePurchaseDto } from 'apps/applications'
import { PurchaseRecordDto, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { Errors, getPayments, getTickets } from '../__helpers__'
import { buildCreatePurchaseDto, Fixture } from './purchase.fixture'

describe('PurchaseService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./purchase.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /purchases', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            let createDto: CreatePurchaseDto
            let createdPurchase: PurchaseRecordDto

            beforeEach(async () => {
                createDto = buildCreatePurchaseDto(fix.customer, fix.heldTickets)

                const { body } = await fix.httpClient.post('/purchases').body(createDto).created()

                createdPurchase = body
            })

            // 구매를 생성하고 반환한다
            it('creates and returns a purchase', async () => {
                expect(createdPurchase).toEqual({
                    id: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                    paymentId: expect.any(String),
                    ...createDto
                })
            })

            // 연관된 결제 기록을 생성한다
            it('creates a corresponding payment record', async () => {
                const payments = await getPayments(fix, [createdPurchase.paymentId])

                expect(payments[0].amount).toEqual(createdPurchase.totalPrice)
            })

            // 구매한 티켓의 상태를 `Sold`으로 변경한다
            it('changes the status of purchased tickets to `Sold`', async () => {
                const soldTickets = await getTickets(fix, pickIds(fix.heldTickets))

                expect(soldTickets.map((ticket) => ticket.status)).toEqual(
                    Array(soldTickets.length).fill(TicketStatus.Sold)
                )
            })

            // 구매하지 않은 티켓의 상태는 그대로 유지한다
            it('does not change the status of unpurchased tickets', async () => {
                const remainingTickets = await getTickets(fix, pickIds(fix.availableTickets))

                expect(remainingTickets.map((ticket) => ticket.status)).toEqual(
                    Array(remainingTickets.length).fill(TicketStatus.Available)
                )
            })
        })

        // 최대 구매 수량을 초과한 경우
        describe('when the number of tickets exceeds the maximum', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                Rules.Ticket.maxTicketsPerPurchase = fix.heldTickets.length - 1
            })

            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const createDto = buildCreatePurchaseDto(fix.customer, fix.heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .badRequest({
                        ...Errors.TicketPurchase.MaxTicketsExceeded,
                        maxCount: expect.any(Number)
                    })
            })
        })

        // 구매 가능 시간이 지난 경우
        describe('when the purchase window is closed', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const createDto = buildCreatePurchaseDto(
                    fix.customer,
                    fix.closedTickets.slice(0, 2)
                )

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .badRequest({
                        ...Errors.TicketPurchase.WindowClosed,
                        purchaseWindowCloseOffsetMinutes: expect.any(Number),
                        purchaseWindowCloseTime: expect.any(String),
                        startTime: expect.any(String)
                    })
            })
        })

        // 선점되지 않은 티켓을 구매하는 경우
        describe('when purchasing unheld tickets', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const createDto = buildCreatePurchaseDto(
                    fix.customer,
                    fix.availableTickets.slice(2)
                )

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .badRequest(Errors.TicketPurchase.TicketNotHeld)
            })
        })

        // 구매 처리 중 내부 오류가 발생하는 경우
        describe('when an internal error occurs during purchase', () => {
            let rollbackPurchaseSpy: jest.SpyInstance

            beforeEach(async () => {
                const { TicketsService } = await import('apps/cores')
                const ticketsService = fix.module.get(TicketsService)

                jest.spyOn(ticketsService, 'updateTicketsStatus').mockImplementationOnce(() => {
                    throw new Error('purchase error')
                })

                const { TicketPurchasService } = await import('apps/applications')
                const ticketPurchaseService = fix.module.get(TicketPurchasService)

                rollbackPurchaseSpy = jest.spyOn(ticketPurchaseService, 'rollbackPurchase')
            })

            // 500 Internal Server Error를 반환하고 구매를 롤백한다
            it('returns 500 Internal Server Error and rolls back the purchase', async () => {
                const createDto = buildCreatePurchaseDto(fix.customer, fix.heldTickets)

                await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                expect(rollbackPurchaseSpy).toHaveBeenCalledTimes(1)
            })
        })
    })
})
