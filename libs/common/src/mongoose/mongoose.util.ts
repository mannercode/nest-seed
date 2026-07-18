import { BadRequestException } from '@nestjs/common'
import { Types, type QueryFilter } from 'mongoose'
import { Assume, escapeRegExp, uniq } from '../utils'
import { MongooseErrors } from './errors'

export const newObjectIdString = () => new Types.ObjectId().toString()
export const objectId = (id: string) => {
    // 잘못된 형식의 id는 BSONError(500)가 아니라 입력 오류(400)로 드러낸다.
    if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(MongooseErrors.InvalidObjectId(id))
    }
    return new Types.ObjectId(id)
}
export const objectIds = (ids: string[]) => ids.map((id) => objectId(id))

export function isDuplicateKeyError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
}

export type QueryBuilderOptions = { allowEmpty?: boolean }

type Transform<T> = (value: T) => any

export class QueryBuilder<T> {
    private query: any = {}

    addEquals(field: string, value?: any): this {
        if (value !== undefined && value !== null) {
            this.query[field] = value
        }
        return this
    }

    addId(field: string, id?: string): this {
        if (id) {
            this.query[field] = objectId(id)
        }
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

            if (start && end) {
                this.query[field] = { $gte: start, $lte: end }
            } else if (start) {
                this.query[field] = { $gte: start }
            } else if (end) {
                this.query[field] = { $lte: end }
            }
        }

        return this
    }

    addRegex(
        field: string,
        value?: string,
        options?: { caseSensitive?: boolean; prefix?: boolean }
    ): this {
        if (value) {
            // 일반 인덱스를 쓰려면 prefix와 caseSensitive를 함께 켜 범위 스캔이 가능해야 한다.
            const pattern = options?.prefix ? '^' + escapeRegExp(value) : escapeRegExp(value)
            this.query[field] = options?.caseSensitive
                ? new RegExp(pattern)
                : new RegExp(pattern, 'i')
        }
        return this
    }

    build({ allowEmpty }: QueryBuilderOptions): QueryFilter<T> {
        if (!allowEmpty && Object.keys(this.query).length === 0) {
            throw new BadRequestException(MongooseErrors.FiltersRequired())
        }

        return this.query
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

    for (const key of keys) {
        const value = record[key as string]
        dto[key] = value as Dto[K]
    }

    return dto
}
