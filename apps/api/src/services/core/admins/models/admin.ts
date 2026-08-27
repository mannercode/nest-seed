import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class Admin extends CrudSchema {
    @Prop({ default: 0, required: true })
    authVersion: number

    @Prop({ required: true })
    email: string

    @Prop({ required: true })
    name: string

    @Prop({ required: true, select: false })
    password: string
}
export const AdminSchema = createCrudSchema(Admin)

// 살아 있는 admin은 deletedAt:null을 공유해 email이 유일하고,
// 삭제된 문서는 삭제 시각으로 분리돼 같은 이메일을 다시 사용할 수 있다.
AdminSchema.index({ email: 1, deletedAt: 1 }, { unique: true })
