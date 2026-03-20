import { createMongooseSchema, MongooseSchema } from '@mannercode/nest-common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'app-common'

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
