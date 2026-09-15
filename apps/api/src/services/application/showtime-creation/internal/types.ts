import { z } from 'zod'
import { ShowtimeSchema } from '#core'

export const ShowtimeCreationStatus = {
    Error: 'error',
    Failed: 'failed',
    Processing: 'processing',
    Succeeded: 'succeeded',
    Waiting: 'waiting'
} as const

export type ShowtimeCreationStatus =
    (typeof ShowtimeCreationStatus)[keyof typeof ShowtimeCreationStatus]

export const ShowtimeCreationTerminalEventSchema = z.discriminatedUnion('status', [
    z.strictObject({
        message: z.string(),
        sagaId: z.string(),
        status: z.literal(ShowtimeCreationStatus.Error)
    }),
    z.strictObject({
        conflictingShowtimes: z.array(ShowtimeSchema),
        sagaId: z.string(),
        status: z.literal(ShowtimeCreationStatus.Failed)
    }),
    z.strictObject({
        createdShowtimeCount: z.number(),
        createdTicketCount: z.number(),
        sagaId: z.string(),
        status: z.literal(ShowtimeCreationStatus.Succeeded)
    })
])

export type ShowtimeCreationTerminalEvent = z.infer<typeof ShowtimeCreationTerminalEventSchema>

export const ShowtimeCreationEventSchema = z.discriminatedUnion('status', [
    ...ShowtimeCreationTerminalEventSchema.options,
    z.strictObject({ sagaId: z.string(), status: z.literal(ShowtimeCreationStatus.Processing) }),
    z.strictObject({ sagaId: z.string(), status: z.literal(ShowtimeCreationStatus.Waiting) })
])
export type ShowtimeCreationEvent = z.infer<typeof ShowtimeCreationEventSchema>

export const ShowtimeCreationStatusResponseSchema = z.discriminatedUnion('status', [
    ...ShowtimeCreationTerminalEventSchema.options,
    z.strictObject({ sagaId: z.string(), status: z.literal('pending') })
])
export type ShowtimeCreationStatusResponse = z.infer<typeof ShowtimeCreationStatusResponseSchema>

export const ValidateAndCreateResultSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('failed'), conflictingShowtimes: z.array(ShowtimeSchema) }),
    z.object({
        kind: z.literal('succeeded'),
        createdShowtimeCount: z.number(),
        createdTicketCount: z.number()
    })
])
export type ValidateAndCreateResult = z.infer<typeof ValidateAndCreateResultSchema>
