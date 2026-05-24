import { BadRequestException } from '@nestjs/common'
import { Types, type QueryFilter } from 'mongoose'
import { Assume, escapeRegExp, uniq } from '../utils'
import { MongooseErrors } from './errors'

export const newObjectIdString = () => new Types.ObjectId().toString()
export const objectId = (id: string) => new Types.ObjectId(id)
export const objectIds = (ids: string[]) => ids.map((id) => objectId(id))

/**
 * MongoDB의 중복 키 에러(E11000)인지 판별한다.
 * unique 인덱스 충돌이 발생했을 때 안전하게 409 Conflict로 매핑하기 위해 사용한다.
 */
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
            // 기본값(부분 문자열 + 대소문자 무시)은 인덱스를 활용하지 못한다.
            // 컬렉션 전체 스캔이 된다.
            // 인덱스를 활용하려면 두 옵션을 함께 켠다.
            // - `prefix: true`로 `^value`를 붙여 접두어 범위 스캔 후보로 만든다.
            // - `caseSensitive: true`로 `i` 플래그를 제외해 일반 오름차순
            //   인덱스를 쓸 수 있게 한다. Mongoose 기본 인덱스는 바이너리
            //   비교라 대소문자 무시 모드와는 맞물리지 않는다.
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
