import { z } from 'zod'
import type { ShowtimeDto } from '#core'

export const ShowtimeCreationStatus = {
    Error: 'error',
    Failed: 'failed',
    Processing: 'processing',
    Succeeded: 'succeeded',
    Waiting: 'waiting'
} as const

export type ShowtimeCreationStatus =
    (typeof ShowtimeCreationStatus)[keyof typeof ShowtimeCreationStatus]

const ShowtimeEventDtoSchema = z.strictObject({
    endTime: z.instanceof(Temporal.Instant),
    id: z.string(),
    movieId: z.string(),
    startTime: z.instanceof(Temporal.Instant),
    theaterId: z.string()
})

export const ShowtimeCreationEventSchema = z.discriminatedUnion('status', [
    z.strictObject({
        message: z.string(),
        sagaId: z.string(),
        status: z.literal(ShowtimeCreationStatus.Error)
    }),
    z.strictObject({
        conflictingShowtimes: z.array(ShowtimeEventDtoSchema),
        sagaId: z.string(),
        status: z.literal(ShowtimeCreationStatus.Failed)
    }),
    z.strictObject({ sagaId: z.string(), status: z.literal(ShowtimeCreationStatus.Processing) }),
    z.strictObject({
        createdShowtimeCount: z.number(),
        createdTicketCount: z.number(),
        sagaId: z.string(),
        status: z.literal(ShowtimeCreationStatus.Succeeded)
    }),
    z.strictObject({ sagaId: z.string(), status: z.literal(ShowtimeCreationStatus.Waiting) })
])

export type ShowtimeCreationEvent = z.infer<typeof ShowtimeCreationEventSchema>

export type ShowtimeCreationTerminalEvent = Extract<
    ShowtimeCreationEvent,
    { status: 'error' | 'failed' | 'succeeded' }
>

export type ShowtimeCreationStatusResponse =
    ShowtimeCreationTerminalEvent | { sagaId: string; status: 'pending' }

export type ValidateAndCreateResult =
    | { kind: 'failed'; conflictingShowtimes: ShowtimeDto[] }
    | { kind: 'succeeded'; createdShowtimeCount: number; createdTicketCount: number }
