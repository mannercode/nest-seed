import { z } from 'zod'

export const RequestShowtimeCreationResponseSchema = z.strictObject({ sagaId: z.string() })
export type RequestShowtimeCreationResponse = z.infer<typeof RequestShowtimeCreationResponseSchema>
