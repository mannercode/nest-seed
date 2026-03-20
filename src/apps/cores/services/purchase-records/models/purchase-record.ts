import { createMongooseSchema, MongooseSchema } from '@mannercode/nest-common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'app-common'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

export enum PurchaseItemType {
    Foods = 'foods',
    Tickets = 'tickets'
}

export class PurchaseItem {
    @IsNotEmpty()
    @IsString()
    itemId: string

    @IsEnum(PurchaseItemType)
    type: PurchaseItemType
}

@Schema(MongooseConfigModule.schemaOptions)
export class PurchaseRecord extends MongooseSchema {
    @Prop({ required: true })
    customerId: string

    @Prop({ default: null })
    paymentId: string

    @Prop({ required: true, type: [Object] })
    purchaseItems: PurchaseItem[]

    @Prop({ required: true })
    totalPrice: number
}
export const PurchaseRecordSchema = createMongooseSchema(PurchaseRecord)
