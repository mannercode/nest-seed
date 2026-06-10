import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class Admin extends CrudSchema {
    @Prop({ required: true })
    email: string

    @Prop({ required: true })
    name: string

    @Prop({ required: true, select: false })
    password: string
}
export const AdminSchema = createCrudSchema(Admin)

// 소프트 삭제된 admin이 이메일을 영구 점유하지 않도록 (email, deletedAt) 복합 유일 인덱스를 쓴다.
// 자세한 근거는 users 모델의 같은 인덱스 주석을 본다.
AdminSchema.index({ email: 1, deletedAt: 1 }, { unique: true })
