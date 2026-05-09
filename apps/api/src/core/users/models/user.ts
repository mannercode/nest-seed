import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'

@Schema(MongooseConfigModule.schemaOptions)
export class User extends CrudSchema {
    @Prop({ required: true })
    birthDate: Date

    @Prop({ required: true, unique: true })
    email: string

    @Prop({ required: true })
    name: string

    @Prop({ required: true, select: false })
    password: string
}
export const UserSchema = createCrudSchema(User)

// 검색 인덱스 없음 (email 의 unique single-field 인덱스는 @Prop 로 자동 생성).
// cycle-31 substring 회귀로 prefix 인덱스 활용 불가 — 모두 제거.
