import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class Admin extends CrudSchema {
    @Prop({ required: true, unique: true })
    email: string

    @Prop({ required: true })
    name: string

    @Prop({ required: true, select: false })
    password: string
}
export const AdminSchema = createCrudSchema(Admin)
