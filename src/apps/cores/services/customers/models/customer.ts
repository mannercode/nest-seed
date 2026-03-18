import { createMongooseSchema, MongooseSchema } from '@mannercode/nestlib-common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'

@Schema(MongooseConfigModule.schemaOptions)
export class Customer extends MongooseSchema {
    @Prop({ required: true })
    birthDate: Date

    @Prop({ required: true, unique: true })
    email: string

    @Prop({ required: true })
    name: string

    @Prop({ required: true, select: false })
    password: string
}
export const CustomerSchema = createMongooseSchema(Customer)

CustomerSchema.index({ name: 'text' })
