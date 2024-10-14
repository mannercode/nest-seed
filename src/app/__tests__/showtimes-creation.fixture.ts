import { addMinutes, HttpClient, jsonToObject, pickIds } from 'common'
import { MovieDto } from 'services/movies'
import { CreateShowtimesDto, ShowtimeDto, ShowtimesCreateErrorEvent } from 'services/showtimes'
import { getAllSeats, TheaterDto } from 'services/theaters'
import { TicketDto } from 'services/tickets'

export const makeCreateShowtimesDto = (movie: MovieDto, theaters: TheaterDto[], overrides = {}) => {
    const createDto = {
        movieId: movie.id,
        theaterIds: pickIds(theaters),
        durationMinutes: 1,
        startTimes: [new Date(0)],
        ...overrides
    } as CreateShowtimesDto

    if (!createDto.movieId || !createDto.theaterIds)
        throw new Error('movie or theaters is not defined')

    const expectedShowtimes = createDto.theaterIds.flatMap((theaterId) =>
        createDto.startTimes.map(
            (startTime) =>
                ({
                    id: expect.anything(),
                    movieId: createDto.movieId,
                    theaterId,
                    startTime,
                    endTime: addMinutes(startTime, createDto.durationMinutes)
                }) as ShowtimeDto
        )
    )

    const expectedTickets = expectedShowtimes.flatMap((showtime) => {
        const theater = theaters.find((theater) => theater.id === showtime.theaterId)!

        return theater.seatmap
            ? getAllSeats(theater.seatmap).map(
                  (seat) =>
                      ({
                          id: expect.anything(),
                          showtimeId: showtime.id,
                          theaterId: showtime.theaterId,
                          movieId: showtime.movieId,
                          seat,
                          status: 'open'
                      }) as TicketDto
              )
            : []
    })

    return { createDto, expectedShowtimes, expectedTickets }
}

export const createShowtimes = async (client: HttpClient, createDto: CreateShowtimesDto) => {
    const results = await Promise.all([
        castForShowtimes(client, 1),
        castForTickets(client, 1),
        client.post('/showtimes').body(createDto).accepted()
    ])

    const showtimesMap = results[0]
    const ticketsMap = results[1]
    const { body } = results[2]
    const showtimes = Array.from(showtimesMap.values()).flat()
    const tickets = Array.from(ticketsMap.values()).flat()

    return { batchId: body.batchId, showtimes, tickets }
}

export async function castForShowtimes(client: HttpClient, count: number) {
    return new Promise<Map<string, ShowtimeDto[]>>((resolve, reject) => {
        const showtimesMap = new Map<string, ShowtimeDto[]>()

        client.get('/showtimes/events/').sse(async (data: string) => {
            const event = JSON.parse(data)

            if (event.status === 'complete') {
                const batchId = event.batchId
                const { body } = await client.get('/showtimes').query({ batchId }).ok()
                showtimesMap.set(batchId, body.items)

                if (showtimesMap.size === count) resolve(showtimesMap)
            } else if (event.status === 'error' || event.status === 'fail') {
                reject(event)
            }
        }, reject)
    })
}

export async function castForTickets(client: HttpClient, count: number) {
    return new Promise<Map<string, TicketDto[]>>((resolve, reject) => {
        const ticketsMap = new Map<string, TicketDto[]>()

        client.get('/tickets/events/').sse(async (data: string) => {
            const event = JSON.parse(data)
            if (event.status === 'complete') {
                const batchId = event.batchId
                const { body } = await client.get('/tickets').query({ batchId }).ok()
                ticketsMap.set(batchId, body.items)

                if (ticketsMap.size === count) resolve(ticketsMap)
            } else if (event.status === 'error') {
                reject(event)
            }
        }, reject)
    })
}

async function castForFailShowtimes(client: HttpClient, count: number) {
    return new Promise<Map<string, ShowtimeDto[]>>((resolve, reject) => {
        const showtimesMap = new Map<string, ShowtimeDto[]>()

        client.get('/showtimes/events/').sse(async (data: string) => {
            const event = JSON.parse(data)

            if (event.status === 'fail') {
                showtimesMap.set(event.batchId, event.conflictShowtimes)

                if (showtimesMap.size === count) resolve(showtimesMap)
            } else if (event.status === 'error' || event.status === 'complete') {
                reject(event)
            }
        }, reject)
    })
}

export const failShowtimes = async (client: HttpClient, createDto: CreateShowtimesDto) => {
    const results = await Promise.all([
        castForFailShowtimes(client, 1),
        client.post('/showtimes').body(createDto).accepted()
    ])

    const showtimesMap = results[0]
    const conflictShowtimes = jsonToObject(Array.from(showtimesMap.values()).flat())

    return { conflictShowtimes }
}

async function castForErrorShowtimes(client: HttpClient, count: number) {
    return new Promise<Map<string, ShowtimesCreateErrorEvent>>((resolve, reject) => {
        const events = new Map<string, ShowtimesCreateErrorEvent>()

        client.get('/showtimes/events/').sse(async (data: string) => {
            const event = JSON.parse(data)

            if (event.status === 'error') {
                events.set(event.batchId, event)

                if (events.size === count) resolve(events)
            } else if (event.status === 'fail' || event.status === 'complete') {
                reject(event)
            }
        }, reject)
    })
}

export const errorShowtimes = async (client: HttpClient, createDto: CreateShowtimesDto) => {
    const results = await Promise.all([
        castForErrorShowtimes(client, 1),
        client.post('/showtimes').body(createDto).accepted()
    ])

    const errorEvents = results[0]
    const errors = jsonToObject(Array.from(errorEvents.values()).flat())

    return errors[0]
}
