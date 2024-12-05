import { Prop, Schema } from '@nestjs/mongoose'
import { IsEnum, IsString, IsNotEmpty } from 'class-validator'
import { MongooseSchema, SchemaJson, createMongooseSchema, createSchemaOptions } from 'common'
import { HydratedDocument, Types } from 'mongoose'

export enum PurchaseType {
    ticket = 'ticket'
}

export class PurchaseItem {
    @IsEnum(PurchaseType)
    type: PurchaseType

    @IsString()
    @IsNotEmpty()
    ticketId: string
}

@Schema(createSchemaOptions({ json: { timestamps: true } }))
export class Purchase extends MongooseSchema {
    @Prop({ required: true })
    customerId: Types.ObjectId

    @Prop({ required: true })
    totalPrice: number

    @Prop({ type: [Object], required: true })
    items: PurchaseItem[]
}
export type PurchaseDto = SchemaJson<Purchase>

export type PurchaseDocument = HydratedDocument<Purchase>
export const PurchaseSchema = createMongooseSchema(Purchase, {})
