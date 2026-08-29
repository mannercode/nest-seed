import type { BulkCreateShowtimesDto } from '../dtos/index.js'

export type ShowtimeCreationWorkflowInput = { createDto: BulkCreateShowtimesDto; sagaId: string }
