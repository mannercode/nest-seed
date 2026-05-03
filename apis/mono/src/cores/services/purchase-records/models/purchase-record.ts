import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { MongooseConfigModule } from 'config'

export const PurchaseItemType = {
    Foods: 'foods',
    Tickets: 'tickets'
} as const

export type PurchaseItemType = (typeof PurchaseItemType)[keyof typeof PurchaseItemType]

export class PurchaseItem {
    @IsNotEmpty()
    @IsString()
    itemId: string

    @IsEnum(PurchaseItemType)
    type: PurchaseItemType
}

@Schema(MongooseConfigModule.schemaOptions)
export class PurchaseRecord extends CrudSchema {
    @Prop({ required: true })
    customerId: string

    @Prop({ default: null })
    paymentId: string

    @Prop({ required: true, type: [Object] })
    purchaseItems: PurchaseItem[]

    @Prop({ required: true })
    totalPrice: number
}
export const PurchaseRecordSchema = createCrudSchema(PurchaseRecord)
