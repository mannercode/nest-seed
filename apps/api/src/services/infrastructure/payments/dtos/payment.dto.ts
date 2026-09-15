import { InstantFromInputSchema } from '@mannercode/common'
import { PaymentStatus } from '../models/index.js'
import { z } from 'zod'

export const PaymentSchema = z.strictObject({
    amount: z.number(),
    createdAt: InstantFromInputSchema,
    id: z.string(),
    purchaseRecordId: z.string(),
    status: z.enum(PaymentStatus),
    updatedAt: InstantFromInputSchema,
    userId: z.string()
})

export type PaymentDto = z.infer<typeof PaymentSchema>
