import { BadRequestException } from '@nestjs/common'
import { ObjectId, type Document, type Filter } from 'mongodb'
import { Assume, escapeRegExp, uniq } from '../utils/index.js'
import { MongoErrors } from './errors.js'

export const newObjectIdString = () => new ObjectId().toHexString()

export const objectId = (id: string | ObjectId) => {
    if (id instanceof ObjectId) return id
    if (!ObjectId.isValid(id)) {
        throw new BadRequestException(MongoErrors.InvalidObjectId(id))
    }
    return new ObjectId(id)
}

export const objectIds = (ids: Array<ObjectId | string>) => ids.map((id) => objectId(id))

export function mongoToPublic<T>(doc: Document & { _id: ObjectId }): T
export function mongoToPublic<T>(doc: null | (Document & { _id: ObjectId })): null | T
export function mongoToPublic<T>(doc: null | (Document & { _id: ObjectId })): null | T {
    if (!doc) return null
    return Object.assign(doc, { id: doc._id.toHexString() }) as T
}

export function mongoArrayToPublic<T>(docs: Array<Document & { _id: ObjectId }>): T[] {
    return docs.map((doc) => mongoToPublic<T>(doc))
}

export function withoutPublicId<T>(doc: T & { id?: string }): Omit<T, 'id'> {
    const stored = { ...doc }
    delete stored.id
    return stored
}

export function isDuplicateKeyError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
}

const WRITE_CONCERN_FAILED_CODE = 64
type ErrorRecord = Record<string, unknown>

export function isWriteConcernTimeoutError(error: unknown): boolean {
    const pending: { isWriteConcernField: boolean; value: unknown }[] = [
        { isWriteConcernField: false, value: error }
    ]
    const visited = new Set<object>()

    while (pending.length > 0) {
        const current = pending.pop()
        if (!current || !isErrorRecord(current.value) || visited.has(current.value)) continue

        const record = current.value
        visited.add(record)
        const errInfo = isErrorRecord(record.errInfo) ? record.errInfo : undefined
        const identifiesWriteConcern =
            current.isWriteConcernField ||
            record.name === 'MongoWriteConcernError' ||
            record.code === WRITE_CONCERN_FAILED_CODE ||
            record.codeName === 'WriteConcernFailed'
        const identifiesTimeout =
            errInfo?.wtimeout === true ||
            [record.message, record.errmsg].some(
                (message) => typeof message === 'string' && isWriteConcernTimeoutMessage(message)
            )

        if (identifiesWriteConcern && identifiesTimeout) return true

        for (const key of ['cause', 'errorResponse', 'result'] as const) {
            pending.push({ isWriteConcernField: false, value: record[key] })
        }
        pending.push({ isWriteConcernField: true, value: record.writeConcernError })
    }

    return false
}

function isErrorRecord(value: unknown): value is ErrorRecord {
    return typeof value === 'object' && value !== null
}

function isWriteConcernTimeoutMessage(value: string): boolean {
    const message = value.toLowerCase()
    return (
        message.includes('wtimeout') ||
        (message.includes('timed out') &&
            (message.includes('waiting for replication') || message.includes('write concern')))
    )
}

export type QueryBuilderOptions = { allowEmpty?: boolean }
type Transform<T> = (value: T) => any

export class QueryBuilder<_T> {
    private query: Record<string, any> = {}

    addEquals(field: string, value?: any): this {
        if (value !== undefined && value !== null) this.query[field] = value
        return this
    }

    addId(field: string, id?: string): this {
        if (id) this.query[field] = objectId(id)
        return this
    }

    addIn(field: string, ids?: string[]): this {
        if (ids && ids.length > 0) {
            const uniqueIds = uniq(ids)
            Assume.equalLength(
                uniqueIds,
                ids,
                `Duplicate ${String(field)} detected and removed: ${ids}`
            )
            this.query[field] = { $in: uniqueIds }
        }
        return this
    }

    addRange(field: string, range?: { end?: Date; start?: Date }): this {
        if (range) {
            const { end, start } = range
            if (start && end) this.query[field] = { $gte: start, $lte: end }
            else if (start) this.query[field] = { $gte: start }
            else if (end) this.query[field] = { $lte: end }
        }
        return this
    }

    addRegex(
        field: string,
        value?: string,
        options?: { caseSensitive?: boolean; prefix?: boolean }
    ): this {
        if (value) {
            const pattern = options?.prefix ? '^' + escapeRegExp(value) : escapeRegExp(value)
            this.query[field] = options?.caseSensitive
                ? new RegExp(pattern)
                : new RegExp(pattern, 'i')
        }
        return this
    }

    build({ allowEmpty }: QueryBuilderOptions = {}): Filter<Document> {
        if (!allowEmpty && Object.keys(this.query).length === 0) {
            throw new BadRequestException(MongoErrors.FiltersRequired())
        }
        return this.query as Filter<Document>
    }
}

export function assignIfDefined<
    Target extends Record<string, any>,
    Source extends Record<string, any>,
    K extends keyof Source & keyof Target
>(target: Target, source: Source, key: K, transform?: Transform<NonNullable<Source[K]>>): void {
    const value = source[key]
    if (value === undefined) return
    target[key] = transform ? transform(value) : value
}

export function mapDocToDto<Doc extends object, Dto extends object, K extends keyof Dto>(
    doc: Doc,
    dtoClass: new () => Dto,
    keys: K[]
): Dto {
    const dto = new dtoClass()
    const record = doc as Record<string, unknown>
    for (const key of keys) dto[key] = record[key as string] as Dto[K]
    return dto
}
