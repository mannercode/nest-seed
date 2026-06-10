import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class User extends CrudSchema {
    @Prop({ required: true })
    birthDate: Date

    @Prop({ required: true })
    email: string

    @Prop({ required: true })
    name: string

    @Prop({ required: true, select: false })
    password: string
}
export const UserSchema = createCrudSchema(User)

// email 단독 unique 인덱스는 소프트 삭제된 문서가 이메일을 영구 점유해 탈퇴 후 재가입을 막는다.
// (email, deletedAt) 복합 유일 인덱스는 살아 있는 문서(deletedAt: null)끼리만 충돌시키고,
// 삭제된 문서는 삭제 시각이 달라 자리를 비켜 준다.
// 사용자 검색은 부분 문자열 정규식이라 일반 인덱스를 활용하지 못하므로 별도 검색 인덱스는 두지 않는다.
UserSchema.index({ email: 1, deletedAt: 1 }, { unique: true })
