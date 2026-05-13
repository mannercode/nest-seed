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

// `email`의 unique 인덱스는 `@Prop({ unique: true })`가 생성한다. 사용자 검색은
// 부분 문자열 정규식이라 일반 인덱스를 활용하지 못하므로 별도 검색 인덱스는 두지 않는다.
