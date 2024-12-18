import { expect } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import {
    addEqualQuery,
    addIdQuery,
    addInQuery,
    addRangeQuery,
    addRegexQuery,
    newObjectId,
    objectId,
    objectIds,
    validateFilters
} from 'common'
import { escapeRegExp } from 'lodash'
import { Types } from 'mongoose'

describe('MongooseRepository Utils', () => {
    it('newObjectId', async () => {
        const objectId = newObjectId()
        expect(Types.ObjectId.isValid(objectId)).toBeTruthy()
    })

    describe('objectId', () => {
        it('should convert a string to an ObjectId', () => {
            const idString = '507f1f77bcf86cd799439011'
            const result = objectId(idString)

            expect(result).toBeInstanceOf(Types.ObjectId)
            expect(result.toString()).toBe(idString)
        })

        it('should throw an error for invalid ObjectId strings', () => {
            const invalidId = 'invalid-id'

            expect(() => objectId(invalidId)).toThrow()
        })
    })

    describe('objectIds', () => {
        it('should convert an array of strings to an array of ObjectIds', () => {
            const idStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
            const result = objectIds(idStrings)

            expect(result).toHaveLength(2)
            result.forEach((id, index) => {
                expect(id).toBeInstanceOf(Types.ObjectId)
                expect(id.toString()).toBe(idStrings[index])
            })
        })

        it('should return an empty array when given an empty array', () => {
            const result = objectIds([])

            expect(result).toEqual([])
        })

        it('should throw an error if any string in the array is invalid', () => {
            const idStrings = ['507f1f77bcf86cd799439011', 'invalid-id']

            expect(() => objectIds(idStrings)).toThrow()
        })
    })

    describe('addEqualQuery', () => {
        it('should add equal query when value is provided', () => {
            const query: any = {}
            const field = 'movieId'
            const value = '60d5ec49f8d2e30d8c8b4567'

            addEqualQuery(query, field, value)

            expect(query).toHaveProperty(field)
            expect(query[field]).toEqual(value)
        })

        it('should not add query when value is not provided', () => {
            const query: any = {}
            const field = 'movieId'
            const value = undefined

            addEqualQuery(query, field, value)

            expect(query).not.toHaveProperty(field)
        })
    })

    describe('addIdQuery', () => {
        it('should add equal query when id is provided', () => {
            const query: any = {}
            const field = 'movieId'
            const id = '60d5ec49f8d2e30d8c8b4567'

            addIdQuery(query, field, id)

            expect(query).toHaveProperty(field)
            expect(query[field]).toEqual(objectId(id))
        })

        it('should not add query when id is not provided', () => {
            const query: any = {}
            const field = 'movieId'
            const id = undefined

            addIdQuery(query, field, id)

            expect(query).not.toHaveProperty(field)
        })
    })

    describe('addInQuery', () => {
        it('should add $in query when ids are provided', () => {
            const query: any = {}
            const field = 'movieId'
            const ids = ['60d5ec49f8d2e30d8c8b4567', '60d5ec49f8d2e30d8c8b4568']

            addInQuery(query, field, ids)

            expect(query).toHaveProperty(field)
            expect(query[field].$in).toEqual(objectIds(ids))
        })

        it('should not add query when ids are not provided', () => {
            const query: any = {}
            const field = 'movieId'
            const ids = undefined

            addInQuery(query, field, ids)

            expect(query).not.toHaveProperty(field)
        })

        it('should not add query when ids array is empty', () => {
            const query: any = {}
            const field = 'movieId'
            const ids: string[] = []

            addInQuery(query, field, ids)

            expect(query).not.toHaveProperty(field)
        })
    })

    describe('addRegexQuery', () => {
        it('should add RegExp query when value is provided', () => {
            const query: any = {}
            const field = 'name'
            const value = 'Inception'

            addRegexQuery(query, field, value)

            expect(query).toHaveProperty(field)
            expect(query[field]).toEqual(new RegExp('Inception', 'i'))
        })

        it('should escape special characters in the value', () => {
            const query: any = {}
            const field = 'name'
            const value = 'Star Wars (Episode IV)'

            addRegexQuery(query, field, value)

            const escapedValue = escapeRegExp(value)
            expect(query[field]).toEqual(new RegExp(escapedValue, 'i'))
        })

        it('should not add query when value is not provided', () => {
            const query: any = {}
            const field = 'name'
            const value = undefined

            addRegexQuery(query, field, value)

            expect(query).not.toHaveProperty(field)
        })

        it('should not add query when value is an empty string', () => {
            const query: any = {}
            const field = 'name'
            const value = ''

            addRegexQuery(query, field, value)

            expect(query).not.toHaveProperty(field)
        })
    })

    describe('addRangeQuery', () => {
        it('should add $gte and $lte when both start and end are provided', () => {
            const query: any = {}
            const field = 'startTime'
            const range = { start: new Date('2024-01-01'), end: new Date('2024-12-31') }

            addRangeQuery(query, field, range)

            expect(query).toHaveProperty(field)
            expect(query[field]).toEqual({
                $gte: range.start,
                $lte: range.end
            })
        })

        it('should add only $gte when only start is provided', () => {
            const query: any = {}
            const field = 'startTime'
            const range = { start: new Date('2024-01-01'), end: undefined }

            addRangeQuery(query, field, range)

            expect(query).toHaveProperty(field)
            expect(query[field]).toEqual({
                $gte: range.start
            })
        })

        it('should add only $lte when only end is provided', () => {
            const query: any = {}
            const field = 'startTime'
            const range = { start: undefined, end: new Date('2024-12-31') }

            addRangeQuery(query, field, range)

            expect(query).toHaveProperty(field)
            expect(query[field]).toEqual({
                $lte: range.end
            })
        })

        it('should not add query when range is not provided', () => {
            const query: any = {}
            const field = 'startTime'
            const range = undefined

            addRangeQuery(query, field, range)

            expect(query).not.toHaveProperty(field)
        })
    })

    describe('validateFilters', () => {
        it('should throw BadRequestException when query is empty', () => {
            const query: any = {}

            expect(() => validateFilters(query)).toThrow(BadRequestException)
            expect(() => validateFilters(query)).toThrow(
                'At least one filter condition must be provided.'
            )
        })

        it('should not throw when query has at least one condition', () => {
            const query: any = { movieId: { $in: objectIds(['60d5ec49f8d2e30d8c8b4567']) } }

            expect(() => validateFilters(query)).not.toThrow()
        })
    })
})
