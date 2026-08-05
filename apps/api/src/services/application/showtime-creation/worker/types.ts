import type { BulkCreateShowtimesDto } from '../dtos'

export type ShowtimeCreationWorkflowInput = { createDto: BulkCreateShowtimesDto; sagaId: string }
