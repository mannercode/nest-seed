import { z } from 'zod'
import { PurchaseItemType } from '../models/index.js'

export const PurchaseItemSchema = z.strictObject({
    itemId: z.string().min(1),
    type: z.enum(PurchaseItemType)
})

export type PurchaseItemDto = z.infer<typeof PurchaseItemSchema>
