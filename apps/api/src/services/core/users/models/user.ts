import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@Schema(MONGOOSE_SCHEMA_OPTIONS)
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

// `email` 의 단일 필드 unique 인덱스는 `@Prop({ unique: true })` 가 알아서
// 만들어 준다. 검색용 인덱스는 따로 두지 않는다. 부분 문자열 정규식이라
// 어차피 인덱스를 못 탄다.
