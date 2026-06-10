import type { ShowtimeDto } from 'core'

export const ShowtimeCreationStatus = {
    Error: 'error',
    Failed: 'failed',
    Processing: 'processing',
    Succeeded: 'succeeded',
    Waiting: 'waiting'
} as const

export type ShowtimeCreationStatus =
    (typeof ShowtimeCreationStatus)[keyof typeof ShowtimeCreationStatus]

export type ShowtimeCreationEvent =
    | { sagaId: string; status: typeof ShowtimeCreationStatus.Error; message: string }
    | {
          sagaId: string
          status: typeof ShowtimeCreationStatus.Failed
          conflictingShowtimes: ShowtimeDto[]
      }
    | { sagaId: string; status: typeof ShowtimeCreationStatus.Processing }
    | {
          sagaId: string
          status: typeof ShowtimeCreationStatus.Succeeded
          createdShowtimeCount: number
          createdTicketCount: number
      }
    | { sagaId: string; status: typeof ShowtimeCreationStatus.Waiting }
