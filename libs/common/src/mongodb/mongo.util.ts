import { BadRequestException } from '@nestjs/common'
import { ObjectId, type Document, type Filter } from 'mongodb'
import { Assume, DateUtil, escapeRegExp, uniq } from '../utils/index.js'
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
    decodeMongoDates(doc)
    return Object.assign(doc, { id: doc._id.toHexString() }) as T
}

export function mongoArrayToPublic<T>(docs: Array<Document & { _id: ObjectId }>): T[] {
    return docs.map((doc) => mongoToPublic<T>(doc))
}

export function withoutPublicId<T extends object>(doc: T & { id?: string }): Document {
    const stored = { ...doc }
    delete stored.id
    return encodeMongoDocument(stored)
}

/** MongoDB driver 경계에서 Temporal 값을 BSON이 이해하는 값으로 변환한다. */
export function encodeMongoValues(value: unknown): unknown {
    if (value instanceof Temporal.Instant) return DateUtil.toDate(value)
    if (value instanceof Temporal.PlainDate) return DateUtil.plainDateToDate(value)
    if (Array.isArray(value)) return value.map(encodeMongoValues)
    if (!isEncodableRecord(value)) return value

    return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, encodeMongoValues(nested)])
    )
}

/** Mongo driver가 받는 document 형태라는 단언을 Temporal 변환 경계 한 곳에 모은다. */
export function encodeMongoDocument(value: object): Document {
    return encodeMongoValues(value) as Document
}

function isEncodableRecord(value: unknown): value is Record<string, unknown> {
    if (
        value === null ||
        typeof value !== 'object' ||
        Object.prototype.toString.call(value) !== '[object Object]'
    ) {
        return false
    }

    return !('_bsontype' in value) && !('toBSON' in value && typeof value.toBSON === 'function')
}

/** BSON Date로 저장된 날짜 전용 필드를 PlainDate로 정규화한다. */
export function plainDateFromMongo(
    value: Date | Temporal.Instant | Temporal.PlainDate
): Temporal.PlainDate {
    if (value instanceof Temporal.PlainDate) return value
    if (value instanceof Temporal.Instant) return DateUtil.toPlainDate(DateUtil.toDate(value))
    return DateUtil.toPlainDate(value)
}

function decodeMongoDates(value: unknown): unknown {
    if (value instanceof Date) return DateUtil.fromDate(value)
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++)
            value[index] = decodeMongoDates(value[index])
        return value
    }
    if (!isPlainObject(value)) return value

    for (const [key, nested] of Object.entries(value)) {
        value[key] = decodeMongoDates(nested)
    }
    return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

export function isDuplicateKeyError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
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

    addRange(field: string, range?: { end?: Temporal.Instant; start?: Temporal.Instant }): this {
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
        return encodeMongoDocument(this.query)
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
