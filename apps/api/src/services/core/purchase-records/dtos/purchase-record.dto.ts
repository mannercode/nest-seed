import { InstantFromInputSchema } from '@mannercode/common'
import { PurchaseItemSchema } from './purchase-item.dto.js'
import { z } from 'zod'

export const PurchaseRecordSchema = z.strictObject({
    createdAt: InstantFromInputSchema,
    userId: z.string(),
    id: z.string(),
    paymentId: z.string().nullable(),
    purchaseItems: z.array(PurchaseItemSchema),
    totalPrice: z.number(),
    updatedAt: InstantFromInputSchema
})

export type PurchaseRecordDto = z.infer<typeof PurchaseRecordSchema>
