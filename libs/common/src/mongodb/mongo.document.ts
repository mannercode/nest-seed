import type { Document, ObjectId } from 'mongodb'

export abstract class CrudDocument {
    createdAt: Temporal.Instant
    deletedAt: Temporal.Instant | null
    id: string
    updatedAt: Temporal.Instant
}

export type StoredDocument<T> = Omit<T, 'id'> & Document & { __v: number; _id: ObjectId }
