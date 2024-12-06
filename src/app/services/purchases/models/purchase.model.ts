import { Prop, Schema } from '@nestjs/mongoose'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { MongooseSchema, createMongooseSchema } from 'common'
import { Mongoose } from 'config'
import { HydratedDocument, Types } from 'mongoose'

export enum PurchaseType {
    ticket = 'ticket'
}

export class PurchaseItem {
    @IsEnum(PurchaseType)
    type: PurchaseType

    @IsString()
    @IsNotEmpty()
    ticketId: Types.ObjectId
}

@Schema(Mongoose.defaultSchemaOptions)
export class Purchase extends MongooseSchema {
    @Prop({ required: true })
    customerId: Types.ObjectId

    @Prop({ required: true })
    totalPrice: number

    @Prop({ type: [Object], required: true })
    items: PurchaseItem[]
}
export type PurchaseDocument = HydratedDocument<Purchase>
export const PurchaseSchema = createMongooseSchema(Purchase)
