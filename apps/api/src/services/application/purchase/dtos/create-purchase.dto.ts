import { z } from 'zod'
import { PurchaseItemSchema, PurchaseItemType } from '#core'

const positiveNumber = z
    .union([z.number(), z.string(), z.boolean()])
    .transform(Number)
    .pipe(z.number().positive())

export const CreatePurchaseSchema = z.strictObject({
    purchaseItems: z
        .array(PurchaseItemSchema)
        .min(1)
        .refine(
            (items) => items.every((item) => item.type === PurchaseItemType.Tickets),
            'Food purchases are not supported; only tickets can be purchased.'
        ),
    totalPrice: positiveNumber
})

export type CreatePurchaseDto = z.infer<typeof CreatePurchaseSchema>
