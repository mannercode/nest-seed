import { z } from 'zod'
import { CreatePurchaseSchema } from '../dtos/index.js'

export const PurchaseWorkflowInputSchema = z.object({
    createDto: CreatePurchaseSchema,
    fingerprint: z.string(),
    idempotencyKey: z.string(),
    userId: z.string()
})
export type PurchaseWorkflowInput = z.infer<typeof PurchaseWorkflowInputSchema>
