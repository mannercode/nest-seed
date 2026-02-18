import { Prop, Schema } from '@nestjs/mongoose'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { MongooseSchema, createMongooseSchema } from 'common'
import { MongooseConfigModule } from 'shared'

export enum PurchaseItemType {
    Tickets = 'tickets',
    Foods = 'foods'
}

export class PurchaseItem {
    @IsEnum(PurchaseItemType)
    type: PurchaseItemType

    @IsString()
    @IsNotEmpty()
    itemId: string
}

@Schema(MongooseConfigModule.schemaOptions)
export class PurchaseRecord extends MongooseSchema {
    @Prop({ required: true })
    customerId: string

    @Prop({ default: null })
    paymentId: string

    @Prop({ required: true })
    totalPrice: number

    @Prop({ type: [Object], required: true })
    purchaseItems: PurchaseItem[]
}
export const PurchaseRecordSchema = createMongooseSchema(PurchaseRecord)
