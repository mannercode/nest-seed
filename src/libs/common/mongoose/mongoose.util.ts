import { BadRequestException } from '@nestjs/common'
import { escapeRegExp, uniq } from 'lodash'
import { Types } from 'mongoose'
import { Verify } from '../validator'
import { MongooseErrors } from './errors'
import type { FilterQuery, HydratedDocument } from 'mongoose'

export const newObjectIdString = () => new Types.ObjectId().toString()
export const objectId = (id: string) => new Types.ObjectId(id)
export const objectIds = (ids: string[]) => ids.map((id) => objectId(id))

export type QueryBuilderOptions = { allowEmpty?: boolean }

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

    addRegex(field: string, value?: string): this {
        if (value) {
            this.query[field] = new RegExp(escapeRegExp(value), 'i')
        }
        return this
    }

    addRange(field: string, range?: { start?: Date; end?: Date }): this {
        if (range) {
            const { start, end } = range

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

    build({ allowEmpty }: QueryBuilderOptions): FilterQuery<T> {
        if (!allowEmpty && Object.keys(this.query).length === 0) {
            throw new BadRequestException(MongooseErrors.FiltersRequired)
        }

        return this.query
    }
}

/**
 * Converts a Mongoose document to a DTO.
 * Mongoose 문서를 Dto로 변환한다
 *
 * @param doc       The Mongoose Document to convert
 * @param DtoClass  The DTO class to instantiate (new () => DTO)
 * @param keys      The list of keys to include in the DTO
 * @returns         A new DTO instance
 */
export function mapDocToDto<
    DOC extends object,
    DTO extends object,
    K extends keyof DOC & keyof DTO
>(doc: HydratedDocument<DOC>, DtoClass: new () => DTO, keys: K[]): DTO {
    type SchemaJson<T> = { [K in keyof T]: T[K] extends Types.ObjectId ? string : T[K] }

    const json = doc.toJSON() as SchemaJson<DOC>
    const dto = new DtoClass()

    for (const key of keys) {
        dto[key] = json[key] as DTO[K]
    }

    return dto
}

type Transform<T> = (value: T) => any

export function assignDefined<
    Target extends Record<string, any>,
    Source extends Record<string, any>,
    K extends keyof Source & keyof Target
>(target: Target, source: Source, key: K, transform?: Transform<NonNullable<Source[K]>>): void {
    const value = source[key]
    if (value === undefined) return

    target[key] = transform ? transform(value as NonNullable<Source[K]>) : value
}
