import { z } from 'zod'
import { PurchaseItemSchema } from '#core'

export const CreatePurchaseSchema = z.strictObject({
    purchaseItems: z.array(PurchaseItemSchema).min(1),
    totalPrice: z.number().positive()
})

export type CreatePurchaseDto = z.infer<typeof CreatePurchaseSchema>
