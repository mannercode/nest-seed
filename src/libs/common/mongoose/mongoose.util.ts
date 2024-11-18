import { BadRequestException } from '@nestjs/common'
import { escapeRegExp } from 'lodash'
import { ObjectId } from './mongoose.schema'

export const newObjectId = () => new ObjectId().toString()
export const objectId = (id: string) => new ObjectId(id)
export const objectIds = (ids: string[]) => ids.map((id) => objectId(id))

export const addEqualQuery = (query: any, field: string, id?: string) => {
    if (id) {
        query[field] = objectId(id)
    }
}

export const addInQuery = (query: any, field: string, ids?: string[]) => {
    if (ids && ids.length > 0) {
        query[field] = { $in: objectIds(ids) }
    }
}

export const addRegexQuery = (query: any, field: string, value?: string) => {
    if (value) {
        query[field] = new RegExp(escapeRegExp(value), 'i')
    }
}

export const addRangeQuery = (query: any, field: string, range?: { start?: Date; end?: Date }) => {
    if (range) {
        const { start, end } = range
        if (start && end) {
            query[field] = { $gte: start, $lte: end }
        } else if (start) {
            query[field] = { $gte: start }
        } else if (end) {
            query[field] = { $lte: end }
        }
    }
}

export const validateFilters = (query: any): void => {
    if (Object.keys(query).length === 0) {
        throw new BadRequestException('At least one filter condition must be provided.')
    }
}
