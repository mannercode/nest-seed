import type { Document, ObjectId } from 'mongodb'

export abstract class CrudDocument {
    createdAt: Date
    deletedAt: Date | null
    id: string
    updatedAt: Date
}

export type StoredDocument<T> = Omit<T, 'id'> & Document & { __v: number; _id: ObjectId }
