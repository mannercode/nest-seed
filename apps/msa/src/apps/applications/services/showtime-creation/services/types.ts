import type { ShowtimeDto } from 'apps/cores'
import type { BulkCreateShowtimesDto } from '../dtos'

export enum ShowtimeCreationStatus {
    Error = 'error',
    Failed = 'failed',
    Processing = 'processing',
    Succeeded = 'succeeded',
    Waiting = 'waiting'
}

export class ShowtimeCreationJobData {
    createDto: BulkCreateShowtimesDto
    sagaId: string
}

export type ShowtimeCreationEvent =
    | { sagaId: string; status: ShowtimeCreationStatus.Error; message: string }
    | { sagaId: string; status: ShowtimeCreationStatus.Failed; conflictingShowtimes: ShowtimeDto[] }
    | { sagaId: string; status: ShowtimeCreationStatus.Processing }
    | {
          sagaId: string
          status: ShowtimeCreationStatus.Succeeded
          createdShowtimeCount: number
          createdTicketCount: number
      }
    | { sagaId: string; status: ShowtimeCreationStatus.Waiting }
