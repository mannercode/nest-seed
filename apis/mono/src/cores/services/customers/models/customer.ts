import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'

@Schema(MongooseConfigModule.schemaOptions)
export class Customer extends CrudSchema {
    @Prop({ required: true })
    birthDate: Date

    @Prop({ required: true, unique: true })
    email: string

    @Prop({ required: true })
    name: string

    @Prop({ required: true, select: false })
    password: string
}
export const CustomerSchema = createCrudSchema(Customer)

CustomerSchema.index({ name: 'text' })
