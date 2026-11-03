import { z } from 'zod'
export const PublishMessageSchema = z.strictObject({ message: z.string().min(1).max(1000) })
export type PublishMessageDto = z.infer<typeof PublishMessageSchema>
export const DemoMessageSchema = PublishMessageSchema.extend({ id: z.string(), userId: z.string() })
export type DemoMessage = z.infer<typeof DemoMessageSchema>
