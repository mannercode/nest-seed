import { generateShortId, sleep } from 'common'
import { isEqual, sortBy } from 'lodash'
import { testObjectId } from 'testlib'
import { holdTickets } from '../__helpers__'
import { Fixture, releaseTickets, searchHeldTicketIds } from './ticket-holding.fixture'

describe('TicketHoldingService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./ticket-holding.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('holdTickets', () => {
        // 다른 고객이 이미 티켓을 선점했을 때
        describe('when another customer has already held the tickets', () => {
            // 선점에 실패한다.
            it('fails to hold the same tickets', async () => {
                const firstCustomerHold = await holdTickets(fix, { customerId: testObjectId(0x1) })
                expect(firstCustomerHold).toBeTruthy()

                const secondCustomerHold = await holdTickets(fix, { customerId: testObjectId(0x2) })
                expect(secondCustomerHold).toBeFalsy()
            })
        })

        // 동일 고객이 이미 선점한 티켓을 다시 선점할 때
        describe('when the same customer re-holds their tickets', () => {
            // 선점에 성공한다.
            it('succeeds in holding the tickets again', async () => {
                const firstHold = await holdTickets(fix)
                expect(firstHold).toBeTruthy()

                const secondHold = await holdTickets(fix)
                expect(secondHold).toBeTruthy()
            })
        })

        // 선점 시간이 만료되었을 때
        describe('when the hold duration has expired', () => {
            // 다른 고객이 해당 티켓을 다시 선점할 수 있다.
            it('allows another customer to hold the tickets', async () => {
                const { Rules } = await import('shared')
                Rules.Ticket.holdDurationInMs = 1000

                const initialHold = await holdTickets(fix, { customerId: testObjectId(0x1) })
                expect(initialHold).toBeTruthy()

                // Attempt to hold before expiry (should fail)
                // 만료 전 선점 시도 (실패)
                const holdBeforeExpiry = await holdTickets(fix, { customerId: testObjectId(0x2) })
                expect(holdBeforeExpiry).toBeFalsy()

                await sleep(Rules.Ticket.holdDurationInMs + 500)

                // Attempt to hold after expiry (should succeed)
                // 만료 후 선점 시도 (성공)
                const holdAfterExpiry = await holdTickets(fix, { customerId: testObjectId(0x2) })
                expect(holdAfterExpiry).toBeTruthy()
            })
        })

        // 동일 고객이 새로운 티켓을 선점할 때
        describe('when the same customer holds a new set of tickets', () => {
            // 이전에 선점했던 티켓은 자동으로 해제된다.
            it('releases the previously held tickets', async () => {
                const oldTickets = [testObjectId(0x30), testObjectId(0x31)]
                const newTickets = [testObjectId(0x40), testObjectId(0x41)]

                // Customer A holds oldTickets
                // A 고객이 oldTickets 선점
                const firstHold = await holdTickets(fix, {
                    customerId: testObjectId(0x1),
                    ticketIds: oldTickets
                })
                expect(firstHold).toBeTruthy()

                // Customer A holds newTickets
                // A 고객이 newTickets 선점
                const secondHold = await holdTickets(fix, {
                    customerId: testObjectId(0x1),
                    ticketIds: newTickets
                })
                expect(secondHold).toBeTruthy()

                // Customer B holds oldTickets (should succeed)
                // B 고객이 oldTickets 선점 (성공해야 함)
                const competitorHold = await holdTickets(fix, {
                    customerId: testObjectId(0x2),
                    ticketIds: oldTickets
                })
                expect(competitorHold).toBeTruthy()
            })
        })

        // 여러 고객이 동시에 선점을 요청할 때 (경쟁 조건)
        describe('when multiple customers request holds simultaneously', () => {
            // 중복 선점 없이 하나의 고객만 성공한다.
            it(
                'prevents duplicate holds, ensuring only one customer succeeds',
                async () => {
                    const results = await Promise.all(
                        Array.from({ length: 100 }, async () => {
                            const showtimeId = generateShortId()
                            const ticketIds = Array.from({ length: 5 }, generateShortId)
                            const customers = Array.from({ length: 10 }, generateShortId)

                            await Promise.all(
                                customers.map((customer) =>
                                    holdTickets(fix, {
                                        customerId: customer,
                                        showtimeId,
                                        ticketIds
                                    })
                                )
                            )

                            const heldTicketIds = await Promise.all(
                                customers.map((customer) =>
                                    searchHeldTicketIds(fix, showtimeId, customer)
                                )
                            )

                            return isEqual(sortBy(heldTicketIds.flat()), sortBy(ticketIds))
                        })
                    )

                    const allTrue = results.every((value) => value === true)
                    expect(allTrue).toBeTruthy()
                },
                60 * 1000
            )
        })
    })

    describe('searchHeldTicketIds', () => {
        const customerId = testObjectId(0x10)
        const ticketIds = [testObjectId(0x30), testObjectId(0x31)]
        const showtimeId = testObjectId(0x40)

        // 유효한 티켓을 선점 중일 때
        describe('when tickets are currently held', () => {
            // 선점된 티켓 ID 목록을 반환한다.
            it('returns the list of held ticket IDs', async () => {
                await holdTickets(fix, { showtimeId, customerId, ticketIds })
                const heldTickets = await searchHeldTicketIds(fix, showtimeId, customerId)
                expect(heldTickets).toEqual(ticketIds)
            })
        })

        // 선점 시간이 만료되었을 때
        describe('when the hold has expired', () => {
            // 빈 목록을 반환한다.
            it('returns an empty list', async () => {
                const { Rules } = await import('shared')
                Rules.Ticket.holdDurationInMs = 1000

                await holdTickets(fix, { showtimeId, customerId, ticketIds })

                const beforeExpiry = await searchHeldTicketIds(fix, showtimeId, customerId)
                expect(beforeExpiry).toEqual(ticketIds)

                await sleep(Rules.Ticket.holdDurationInMs + 500)

                const afterExpiry = await searchHeldTicketIds(fix, showtimeId, customerId)
                expect(afterExpiry).toEqual([])
            })
        })
    })

    describe('releaseTickets', () => {
        const customerId = testObjectId(0x1)
        const customerB = testObjectId(0x2)
        const ticketIds = [testObjectId(0x30), testObjectId(0x31)]
        const showtimeId = testObjectId(0x1)

        // 고객이 선점한 티켓을 해제할 때
        describe('when a customer releases their held tickets', () => {
            // 티켓이 해제되어 다른 고객이 선점할 수 있다.
            it('releases the tickets, making them available for others', async () => {
                // Customer A holds the tickets
                // A 고객이 선점
                const firstHold = await holdTickets(fix, { customerId, showtimeId, ticketIds })
                expect(firstHold).toBeTruthy()

                // Check before release
                // 해제 전 확인
                const beforeRelease = await searchHeldTicketIds(fix, showtimeId, customerId)
                expect(beforeRelease).toEqual(ticketIds)

                // Release the tickets
                // 해제
                const releaseResult = await releaseTickets(fix, showtimeId, customerId)
                expect(releaseResult).toBeTruthy()

                // Check after release
                // 해제 후 확인
                const afterRelease = await searchHeldTicketIds(fix, showtimeId, customerId)
                expect(afterRelease).toEqual([])

                // Customer B holds the tickets (should succeed)
                // B 고객이 선점 (성공해야 함)
                const secondHold = await holdTickets(fix, {
                    customerId: customerB,
                    showtimeId,
                    ticketIds
                })
                expect(secondHold).toBeTruthy()
            })
        })
    })
})
