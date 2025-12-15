import { BadRequestException, Logger } from '@nestjs/common'
import { Prop, Schema } from '@nestjs/mongoose'
import {
    createMongooseSchema,
    mapDocToDto,
    MongooseSchema,
    newObjectId,
    objectId,
    objectIds,
    QueryBuilder
} from 'common'
import { model, Types } from 'mongoose'

it('newObjectId', async () => {
    const objectIdValue = newObjectId()
    expect(Types.ObjectId.isValid(objectIdValue)).toBe(true)
})

describe('objectId', () => {
    it('converts a valid string to an ObjectId', () => {
        const idString = '507f1f77bcf86cd799439011'
        const result = objectId(idString)

        expect(result).toBeInstanceOf(Types.ObjectId)
        expect(result.toString()).toBe(idString)
    })

    it('throws for an invalid string', () => {
        const invalidId = 'invalid-id'

        expect(() => objectId(invalidId)).toThrow(
            'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
        )
    })
})

describe('objectIds', () => {
    it('converts valid strings to ObjectIds', () => {
        const idStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
        const result = objectIds(idStrings)

        expect(result.map((id) => id.toString())).toEqual(idStrings)
        expect(result).toEqual([expect.any(Types.ObjectId), expect.any(Types.ObjectId)])
    })

    it('returns an empty array for empty ids', () => {
        const result = objectIds([])

        expect(result).toEqual([])
    })

    it('throws for an invalid id', () => {
        const idStrings = ['507f1f77bcf86cd799439011', 'invalid-id']

        expect(() => objectIds(idStrings)).toThrow(
            'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
        )
    })
})

describe('QueryBuilder', () => {
    type TestModel = { _id: Types.ObjectId; name: string; createdAt: Date }

    let builder: QueryBuilder<TestModel>

    beforeEach(() => {
        builder = new QueryBuilder<TestModel>()
    })

    describe('addEqual', () => {
        it('adds the condition for a provided value', () => {
            builder.addEqual('name', 'test')
            expect(builder.build({})).toEqual({ name: 'test' })
        })

        it('does not add the condition for undefined or null values', () => {
            builder.addEqual('name', undefined)
            builder.addEqual('name', null)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addId', () => {
        it('adds the ObjectId condition for a provided id', () => {
            const id = new Types.ObjectId().toString()
            builder.addId('_id', id)
            expect(builder.build({})).toEqual({ _id: objectId(id) })
        })

        it('does not add the condition for an undefined id', () => {
            builder.addId('_id', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addIn', () => {
        it('adds an $in condition for provided ids', () => {
            const ids = [new Types.ObjectId().toString(), new Types.ObjectId().toString()]
            builder.addIn('_id', ids)
            expect(builder.build({})).toEqual({ _id: { $in: objectIds(ids) } })
        })

        it('removes duplicates for ids containing duplicates', () => {
            jest.spyOn(Logger, 'error').mockImplementation(() => {})

            const id = new Types.ObjectId().toString()
            const ids = [id, new Types.ObjectId().toString(), id]

            builder.addIn('_id', ids)
            expect(builder.build({})).toEqual({ _id: { $in: objectIds([id, ids[1]]) } })
        })

        it('does not add the condition for empty or undefined ids', () => {
            builder.addIn('_id', [])
            builder.addIn('_id', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addRegex', () => {
        it('adds a regex condition for a provided value', () => {
            builder.addRegex('name', 'test')
            expect(builder.build({})).toEqual({ name: new RegExp('test', 'i') })
        })

        it('does not add the condition for an undefined value', () => {
            builder.addRegex('name', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addRange', () => {
        it('adds $gte and $lte conditions for start and end', () => {
            const range = { start: new Date('2023-01-01'), end: new Date('2023-12-31') }
            builder.addRange('createdAt', range)
            expect(builder.build({})).toEqual({ createdAt: { $gte: range.start, $lte: range.end } })
        })

        it('adds only $gte when only start is provided', () => {
            const range = { start: new Date('2023-01-01') }
            builder.addRange('createdAt', range)
            expect(builder.build({})).toEqual({ createdAt: { $gte: range.start } })
        })

        it('adds only $lte when only end is provided', () => {
            const range = { end: new Date('2023-12-31') }
            builder.addRange('createdAt', range)
            expect(builder.build({})).toEqual({ createdAt: { $lte: range.end } })
        })

        it('does not add the condition for an undefined or empty range', () => {
            builder.addRange('createdAt', undefined)
            builder.addRange('createdAt', {})
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('build', () => {
        it('returns the query object when conditions exist', () => {
            builder.addEqual('name', 'test')
            expect(builder.build({})).toEqual({ name: 'test' })
        })

        it('throws BadRequestException when no conditions exist', () => {
            expect(() => builder.build({})).toThrow(BadRequestException)
        })

        it('allows an empty query when `allowEmpty` is true', () => {
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })
})

describe('mapDocToDto', () => {
    @Schema({ toJSON: { virtuals: true } })
    class Sample extends MongooseSchema {
        @Prop()
        name: string

        @Prop()
        optional?: boolean
    }

    class SampleDto {
        id: string
        name: string
        optional?: boolean
    }

    const sampleSchema = createMongooseSchema(Sample)
    const SampleModel = model<Sample>('SampleForTest', sampleSchema)

    it('maps a document to a DTO', () => {
        const doc = new SampleModel({ name: 'name', optional: undefined })

        const dto = mapDocToDto(doc, SampleDto, ['id', 'name', 'optional'])

        expect(dto).toEqual({ id: expect.any(String), name: 'name', optional: undefined })
    })
})
