import { z } from 'zod'
import { PurchaseItemSchema } from '#core'

const positiveNumber = z
    .union([z.number(), z.string(), z.boolean()])
    .transform(Number)
    .pipe(z.number().positive())

export const CreatePurchaseSchema = z.strictObject({
    purchaseItems: z.array(PurchaseItemSchema).min(1),
    totalPrice: positiveNumber
})

export type CreatePurchaseDto = z.infer<typeof CreatePurchaseSchema>
