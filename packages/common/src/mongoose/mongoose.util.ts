import type { QueryFilter } from 'mongoose'
import { BadRequestException } from '@nestjs/common'
import { escapeRegExp, uniq } from 'lodash'
import { Types } from 'mongoose'
import { Verify } from '../validator'
import { MongooseErrors } from './errors'

export const newObjectIdString = () => new Types.ObjectId().toString()
export const objectId = (id: string) => new Types.ObjectId(id)
export const objectIds = (ids: string[]) => ids.map((id) => objectId(id))

export type QueryBuilderOptions = { allowEmpty?: boolean }

type Transform<T> = (value: T) => any

export class QueryBuilder<T> {
    private query: any = {}

    addEqual(field: string, value?: any): this {
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

    addIn(field: string, ids?: string[] | undefined): this {
        if (ids && ids.length > 0) {
            const uniqueIds = uniq(ids)

            Verify.equalLength(
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

    addRegex(field: string, value?: string): this {
        if (value) {
            this.query[field] = new RegExp(escapeRegExp(value), 'i')
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

    target[key] = transform ? transform(value as NonNullable<Source[K]>) : value
}

export function mapDocToDto<DOC extends object, DTO extends object, K extends keyof DTO>(
    doc: DOC,
    dtoClass: new () => DTO,
    keys: K[]
): DTO {
    const dto = new dtoClass()
    const record = doc as Record<string, unknown>

    for (const key of keys) {
        const value = record[key as string]
        dto[key] = value as DTO[K]
    }

    return dto
}
