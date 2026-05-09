import { pickIds } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { TicketStatus, type TicketDto } from 'core'
import type { TicketsFixture } from './tickets.fixture'
import { buildCreateTicketDto, createTickets, Errors } from '../helpers'

describe('TicketsService', () => {
    let fix: TicketsFixture

    beforeEach(async () => {
        const { createTicketsFixture } = await import('./tickets.fixture')
        fix = await createTicketsFixture()
    })
    afterEach(() => fix.teardown())

    describe('createMany', () => {
        it('생성된 티켓 수를 반환한다', async () => {
            const createDtos = [buildCreateTicketDto({ sagaId: oid(0x1) })]

            const { count } = await fix.ticketsService.createMany(createDtos)

            expect(count).toBe(createDtos.length)
        })
    })

    describe('search', () => {
        describe('id 필터링', () => {
            const sagaId = oid(0x1)
            const movieId = oid(0x2)
            const theaterId = oid(0x3)
            const showtimeId = oid(0x4)
            let ticketForSaga: TicketDto
            let ticketForMovie: TicketDto
            let ticketForTheater: TicketDto
            let ticketForShowtime: TicketDto

            beforeEach(async () => {
                const createdTickets = await createTickets(fix, [
                    { sagaId },
                    { movieId },
                    { theaterId },
                    { showtimeId }
                ])

                ticketForSaga = createdTickets[0]
                ticketForMovie = createdTickets[1]
                ticketForTheater = createdTickets[2]
                ticketForShowtime = createdTickets[3]
            })

            it('sagaIds로 필터링한다', async () => {
                const tickets = await fix.ticketsService.search({ sagaIds: [sagaId] })

                expect(tickets).toEqual([ticketForSaga])
            })

            it('movieIds로 필터링한다', async () => {
                const tickets = await fix.ticketsService.search({ movieIds: [movieId] })

                expect(tickets).toEqual([ticketForMovie])
            })

            it('theaterIds로 필터링한다', async () => {
                const tickets = await fix.ticketsService.search({ theaterIds: [theaterId] })

                expect(tickets).toEqual([ticketForTheater])
            })

            it('showtimeIds로 필터링한다', async () => {
                const tickets = await fix.ticketsService.search({ showtimeIds: [showtimeId] })

                expect(tickets).toEqual([ticketForShowtime])
            })
        })

        it('필터가 비어 있으면 400을 던진다', async () => {
            const promise = fix.ticketsService.search({})

            await expect(promise).rejects.toMatchObject({
                message: Errors.Mongoose.FiltersRequired().message,
                status: HttpStatus.BAD_REQUEST
            })
        })
    })

    describe('updateStatusMany', () => {
        it('주어진 티켓들의 상태를 일괄 변경한 결과를 반환한다', async () => {
            const tickets = await createTickets(fix, [
                { status: TicketStatus.Available },
                { status: TicketStatus.Available },
                { status: TicketStatus.Available }
            ])

            const updatedTickets = await fix.ticketsService.updateStatusMany(
                pickIds(tickets),
                TicketStatus.Sold
            )

            expect(updatedTickets.every((t) => t.status === TicketStatus.Sold)).toBe(true)
        })
    })

    describe('aggregateSales', () => {
        it('showtimeIds에 대한 판매 통계를 반환한다', async () => {
            const showtimeId = oid(0x10)
            const totalCount = 50
            const soldCount = 5

            const createDtos = Array.from({ length: totalCount }, () => ({ showtimeId }))
            const createdTickets = await createTickets(fix, createDtos)

            const soldTickets = createdTickets.slice(0, soldCount)
            await fix.ticketsService.updateStatusMany(pickIds(soldTickets), TicketStatus.Sold)

            const ticketSales = await fix.ticketsService.aggregateSales({
                showtimeIds: [showtimeId]
            })

            expect(ticketSales).toEqual([
                {
                    available: totalCount - soldCount,
                    showtimeId,
                    sold: soldCount,
                    total: totalCount
                }
            ])
        })
    })
})
