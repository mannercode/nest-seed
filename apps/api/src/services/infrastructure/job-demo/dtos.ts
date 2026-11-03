import { z } from 'zod'
export const CreateTextJobSchema = z.strictObject({ text: z.string().min(1).max(1000) })
export type CreateTextJobDto = z.infer<typeof CreateTextJobSchema>
export const TextJobInputSchema = CreateTextJobSchema.extend({ jobId: z.string() })
export const TextJobResultSchema = z.strictObject({
    text: z.string(),
    characterCount: z.number().int()
})
export type TextJobResult = z.infer<typeof TextJobResultSchema>
export const TextJobSchema = z.discriminatedUnion('status', [
    z.strictObject({ jobId: z.string(), status: z.literal('pending') }),
    z.strictObject({
        jobId: z.string(),
        status: z.literal('completed'),
        result: TextJobResultSchema
    })
])
export type TextJobDto = z.infer<typeof TextJobSchema>
