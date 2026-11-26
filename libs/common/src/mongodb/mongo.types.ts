import type { Document, ObjectId, Sort, UpdateFilter, UpdateResult } from 'mongodb'
import type { TransactionContext } from '#common/transaction'

export type MongoDocument = Document
export type MongoObjectId = ObjectId
export type MongoUpdate = UpdateFilter<Document>
export type MongoWriteResult = Omit<UpdateResult, 'upsertedId'> & { upsertedId: string | null }
export type MongoReadOptions<Projection extends Document | undefined = Document | undefined> = {
    projection?: Projection
    sort?: Sort
    limit?: number
    transaction?: TransactionContext
    signal?: AbortSignal
}
export type MongoWriteOptions<Projection extends Document | undefined = Document | undefined> = {
    projection?: Projection
    returnDocument?: 'after' | 'before'
    upsert?: boolean
    transaction?: TransactionContext
    signal?: AbortSignal
}

type PublicField<Key> = Key extends '_id' ? 'id' : Key
type IncludedFields<Doc, P> =
    P extends Record<string, 1 | true>
        ? Pick<Doc, Extract<keyof P | 'id', keyof Doc>>
        : Partial<Doc>

type ProjectedFields<Doc, P> =
    P extends Record<string, 0 | false>
        ? Omit<Doc, PublicField<keyof P>>
        : P extends { _id: 0 | false }
          ? IncludedFields<Omit<Doc, 'id'>, Omit<P, '_id'>>
          : IncludedFields<Doc, P>

// 계산식과 중첩 경로는 원래 필드의 타입도 바꿀 수 있다.
export type ProjectedDocument<Doc, P> = P extends undefined
    ? Doc
    : P extends Record<string, 0 | 1 | boolean>
      ? Exclude<keyof P, keyof Doc | '_id'> extends never
          ? ProjectedFields<Doc, P>
          : Record<string, unknown>
      : Record<string, unknown>
