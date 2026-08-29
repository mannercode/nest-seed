import { z } from 'zod'
import { PurchaseItemType } from '../models/index.js'

const requiredString = z
    .union([z.string(), z.number(), z.boolean()])
    .transform(String)
    .pipe(z.string().min(1))

export const PurchaseItemSchema = z.strictObject({
    itemId: requiredString,
    type: z.enum(PurchaseItemType)
})

export type PurchaseItemDto = z.infer<typeof PurchaseItemSchema>
