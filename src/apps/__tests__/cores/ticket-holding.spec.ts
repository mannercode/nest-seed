import { generateShortId, sleep } from 'common'
import { isEqual, sortBy } from 'lodash'
import { oid } from 'testlib'
import { holdTickets, releaseTickets, searchHeldTicketIds } from '../__fixtures__'
import { Fixture } from './ticket-holding.fixture'

describe('TicketHoldingService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./ticket-holding.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    const customerA = oid(0x1)
    const customerB = oid(0x2)
    const showtimeId = oid(0x10)

    describe('holdTickets', () => {
        // 다른 고객이 이미 선점한 경우
        describe('???', () => {
            beforeEach(async () => {
                await holdTickets(fix, { customerId: customerA, showtimeId })
            })

            // 선점에 실패한다.
            it('???', async () => {
                const result = await holdTickets(fix, { customerId: customerB, showtimeId })

                expect(result).toBeFalsy()
            })
        })

        // 같은 고객이 다시 선점할 경우
        describe('???', () => {
            beforeEach(async () => {
                await holdTickets(fix, { customerId: customerA, showtimeId })
            })

            // 선점에 성공한다.
            it('???', async () => {
                const result = await holdTickets(fix, { customerId: customerA, showtimeId })

                expect(result).toBeTruthy()
            })
        })

        // 선점 시간이 만료된 경우
        describe('???', () => {
            // 다른 고객이 선점할 수 있다
            it('???', async () => {
                const { Rules } = await import('shared')
                Rules.Ticket.holdDurationInMs = 1000

                const initialHold = await holdTickets(fix, {
                    customerId: oid(0x1),
                    showtimeId: oid(0x1)
                })
                expect(initialHold).toBeTruthy()

                // Attempt to hold before expiry (should fail)
                // 만료 전 선점 시도 (실패)
                const holdBeforeExpiry = await holdTickets(fix, {
                    customerId: oid(0x2),
                    showtimeId: oid(0x1)
                })
                expect(holdBeforeExpiry).toBeFalsy()

                await sleep(Rules.Ticket.holdDurationInMs + 500)

                // Attempt to hold after expiry (should succeed)
                // 만료 후 선점 시도 (성공)
                const holdAfterExpiry = await holdTickets(fix, {
                    customerId: oid(0x2),
                    showtimeId: oid(0x1)
                })
                expect(holdAfterExpiry).toBeTruthy()
            })
        })

        // 같은 고객이 다른 티켓을 새로 선점하는 경우
        describe('???', () => {
            // 이전에 선점했던 티켓은 해제한다
            it('???', async () => {
                const oldTickets = [oid(0x30), oid(0x31)]
                const newTickets = [oid(0x40), oid(0x41)]

                // Customer A holds oldTickets
                // A 고객이 oldTickets 선점
                const firstHold = await holdTickets(fix, {
                    customerId: oid(0x1),
                    ticketIds: oldTickets
                })
                expect(firstHold).toBeTruthy()

                // Customer A holds newTickets
                // A 고객이 newTickets 선점
                const secondHold = await holdTickets(fix, {
                    customerId: oid(0x1),
                    ticketIds: newTickets
                })
                expect(secondHold).toBeTruthy()

                // Customer B holds oldTickets (should succeed)
                // B 고객이 oldTickets 선점 (성공해야 함)
                const competitorHold = await holdTickets(fix, {
                    customerId: oid(0x2),
                    ticketIds: oldTickets
                })
                expect(competitorHold).toBeTruthy()
            })
        })

        // 동시에 여러 고객이 선점을 요청하는 경우
        describe('???', () => {
            // 오직 한 고객만 성공한다
            it(
                '???',
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
        const customerId = oid(0x10)
        const ticketIds = [oid(0x30), oid(0x31)]
        const showtimeId = oid(0x40)

        // 선점이 유효한 경우
        describe('???', () => {
            // 선점된 티켓 ID를 반환한다
            it('returns the list of held ticket IDs', async () => {
                await holdTickets(fix, { showtimeId, customerId, ticketIds })
                const heldTickets = await searchHeldTicketIds(fix, showtimeId, customerId)
                expect(heldTickets).toEqual(ticketIds)
            })
        })

        // 선점이 만료된 후
        describe('???', () => {
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
        const customerId = oid(0x1)
        const customerB = oid(0x2)
        const ticketIds = [oid(0x30), oid(0x31)]
        const showtimeId = oid(0x1)

        // 고객이 선점한 티켓을 해제하는 경우
        describe('???', () => {
            // 다른 고객이 선점할 수 있다
            it('???', async () => {
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
