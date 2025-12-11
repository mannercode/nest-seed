import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'

@Schema(MongooseConfigModule.schemaOptions)
export class Customer extends MongooseSchema {
    @Prop({ required: true })
    name: string

    @Prop({ unique: true, required: true })
    email: string

    @Prop({ required: true })
    birthDate: Date

    @Prop({ required: true, select: false })
    password: string
}
export type CustomerDocument = HydratedDocument<Customer>
export const CustomerSchema = createMongooseSchema(Customer)

CustomerSchema.index({ name: 'text' })
