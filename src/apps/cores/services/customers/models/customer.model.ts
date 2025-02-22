import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfig } from 'shared/config'

@Schema(MongooseConfig.schemaOptions)
export class Customer extends MongooseSchema {
    @Prop({ required: true })
    name: string

    @Prop({ unique: true, required: true })
    email: string

    @Prop({ required: true })
    birthdate: Date

    @Prop({ required: true, select: false })
    password: string
}
export type CustomerDocument = HydratedDocument<Customer>
export const CustomerSchema = createMongooseSchema(Customer)
CustomerSchema.index({ name: 1 })
CustomerSchema.index({ name: 'text' })
/**
 * 1. `CustomerSchema.index({ email: 1 })`
 *    이 명령은 `email` 필드에 대해 오름차순(1) 인덱스를 생성합니다.
 *    - 목적: 이메일 주소로 고객을 빠르게 검색할 수 있게 합니다.
 *    - 작동 방식: MongoDB는 이메일 주소를 알파벳 순으로 정렬된 구조에 저장합니다.
 *    - 장점:
 *      - `findByEmail`과 같은 쿼리의 성능을 크게 향상시킵니다.
 *      - 빠른 이메일 중복 확인이 가능합니다.
 *    - 사용 예시: `db.customers.find({ email: "example@email.com" })`
 *    - 참고: 인덱스 생성으로 인해 쓰기 작업 성능이 약간 저하될 수 있으나, 읽기 작업의 이점이 이를 상쇄합니다.
 *
 * 2. `CustomerSchema.index({ name: 'text' })`
 *    이 명령은 `name` 필드에 대해 텍스트 인덱스를 생성합니다.
 *    - 목적: 고객 이름에 대한 전체 텍스트 검색을 가능하게 합니다.
 *    - 작동 방식: MongoDB는 이름 필드의 각 단어를 개별적으로 인덱싱합니다.
 *    - 장점:
 *      - 부분 일치 및 여러 단어 검색을 포함한 복잡한 이름 검색을 효율적으로 수행합니다.
 *      - 검색 결과에 대한 관련도 점수를 제공합니다.
 *    - 사용 예시: `db.customers.find({ $text: { $search: "John Doe" } })`
 *    - 특징:
 *      - 대소문자 구분 없이 검색합니다.
 *      - 기본적으로 불용어(stop words)를 제거합니다.
 *      - 스테밍(stemming)을 지원하여 유사 단어 검색이 가능합니다.
 */
