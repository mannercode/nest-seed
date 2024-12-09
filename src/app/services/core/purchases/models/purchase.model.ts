import { Prop, Schema } from '@nestjs/mongoose'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { MongooseSchema, createMongooseSchema } from 'common'
import { MongooseConfig } from 'config'
import { HydratedDocument, Types } from 'mongoose'

export enum PurchaseItemType {
    ticket = 'ticket'
}

export class PurchaseItem {
    @IsEnum(PurchaseItemType)
    type: PurchaseItemType

    @IsString()
    @IsNotEmpty()
    ticketId: Types.ObjectId
}

@Schema(MongooseConfig.schemaOptions)
export class Purchase extends MongooseSchema {
    @Prop({ required: true })
    customerId: Types.ObjectId

    @Prop({ default: null })
    paymentId: Types.ObjectId

    @Prop({ required: true })
    totalPrice: number

    @Prop({ type: [Object], required: true })
    items: PurchaseItem[]
}
export type PurchaseDocument = HydratedDocument<Purchase>
export const PurchaseSchema = createMongooseSchema(Purchase)
