import type { Document, ObjectId, Sort, UpdateFilter, UpdateResult } from 'mongodb'
import type { TransactionContext } from '../transaction.js'

export type MongoDocument = Document
export type MongoObjectId = ObjectId
export type MongoUpdate = UpdateFilter<Document>
export type MongoWriteResult = Omit<UpdateResult, 'upsertedId'> & { upsertedId: string | null }
export type MongoReadOptions = {
    projection?: MongoDocument
    sort?: Sort
    limit?: number
    transaction?: TransactionContext
    signal?: AbortSignal
}
export type MongoWriteOptions = {
    projection?: MongoDocument
    returnDocument?: 'after' | 'before'
    upsert?: boolean
    transaction?: TransactionContext
    signal?: AbortSignal
}
