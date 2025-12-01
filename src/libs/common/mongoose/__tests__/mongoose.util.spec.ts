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
    describe('when the string is valid', () => {
        it('converts to an ObjectId', () => {
            const idString = '507f1f77bcf86cd799439011'
            const result = objectId(idString)

            expect(result).toBeInstanceOf(Types.ObjectId)
            expect(result.toString()).toBe(idString)
        })
    })

    describe('when the string is invalid', () => {
        it('throws an error', () => {
            const invalidId = 'invalid-id'

            expect(() => objectId(invalidId)).toThrow(
                'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
            )
        })
    })
})

describe('objectIds', () => {
    describe('when all ids are valid', () => {
        it('returns ObjectIds', () => {
            const idStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
            const result = objectIds(idStrings)

            expect(result.map((id) => id.toString())).toEqual(idStrings)
            expect(result).toEqual([expect.any(Types.ObjectId), expect.any(Types.ObjectId)])
        })
    })

    describe('when the ids are empty', () => {
        it('returns an empty array', () => {
            const result = objectIds([])

            expect(result).toEqual([])
        })
    })

    describe('when any id is invalid', () => {
        it('throws an error', () => {
            const idStrings = ['507f1f77bcf86cd799439011', 'invalid-id']

            expect(() => objectIds(idStrings)).toThrow(
                'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
            )
        })
    })
})

describe('QueryBuilder', () => {
    type TestModel = { _id: Types.ObjectId; name: string; createdAt: Date }

    let builder: QueryBuilder<TestModel>

    beforeEach(() => {
        builder = new QueryBuilder<TestModel>()
    })

    describe('addEqual', () => {
        describe('when the value is provided', () => {
            it('adds the condition', () => {
                builder.addEqual('name', 'test')
                expect(builder.build({})).toEqual({ name: 'test' })
            })
        })

        describe('when the value is undefined or null', () => {
            it('does not add the condition', () => {
                builder.addEqual('name', undefined)
                builder.addEqual('name', null)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addId', () => {
        describe('when the id is provided', () => {
            it('adds the ObjectId condition', () => {
                const id = new Types.ObjectId().toString()
                builder.addId('_id', id)
                expect(builder.build({})).toEqual({ _id: objectId(id) })
            })
        })

        describe('when the id is undefined', () => {
            it('does not add the condition', () => {
                builder.addId('_id', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addIn', () => {
        describe('when the ids are provided', () => {
            it('adds an $in condition', () => {
                const ids = [new Types.ObjectId().toString(), new Types.ObjectId().toString()]
                builder.addIn('_id', ids)
                expect(builder.build({})).toEqual({ _id: { $in: objectIds(ids) } })
            })
        })

        describe('when the ids contain duplicates', () => {
            it('removes duplicates', () => {
                jest.spyOn(Logger, 'error').mockImplementation(() => {})

                const id = new Types.ObjectId().toString()
                const ids = [id, new Types.ObjectId().toString(), id]

                builder.addIn('_id', ids)
                expect(builder.build({})).toEqual({ _id: { $in: objectIds([id, ids[1]]) } })
            })
        })

        describe('when the ids are empty or undefined', () => {
            it('does not add the condition', () => {
                builder.addIn('_id', [])
                builder.addIn('_id', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addRegex', () => {
        describe('when the value is provided', () => {
            it('adds a regex condition', () => {
                builder.addRegex('name', 'test')
                expect(builder.build({})).toEqual({ name: new RegExp('test', 'i') })
            })
        })

        describe('when the value is undefined', () => {
            it('does not add the condition', () => {
                builder.addRegex('name', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addRange', () => {
        describe('when the start and end are provided', () => {
            it('adds $gte and $lte conditions', () => {
                const range = { start: new Date('2023-01-01'), end: new Date('2023-12-31') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({
                    createdAt: { $gte: range.start, $lte: range.end }
                })
            })
        })

        describe('when only the start is provided', () => {
            it('adds only $gte', () => {
                const range = { start: new Date('2023-01-01') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({ createdAt: { $gte: range.start } })
            })
        })

        describe('when only the end is provided', () => {
            it('adds only $lte', () => {
                const range = { end: new Date('2023-12-31') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({ createdAt: { $lte: range.end } })
            })
        })

        describe('when the range is undefined or empty', () => {
            it('does not add the condition', () => {
                builder.addRange('createdAt', undefined)
                builder.addRange('createdAt', {})
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('build', () => {
        describe('when the conditions exist', () => {
            it('returns the query object', () => {
                builder.addEqual('name', 'test')
                expect(builder.build({})).toEqual({ name: 'test' })
            })
        })

        describe('when no conditions exist', () => {
            it('throws BadRequestException', () => {
                expect(() => builder.build({})).toThrow(BadRequestException)
            })
        })

        describe('when the `allowEmpty` flag is true', () => {
            it('allows an empty query', () => {
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
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

    describe('when mapping a document to a DTO', () => {
        it('returns the DTO', () => {
            const doc = new SampleModel({ name: 'name', optional: undefined })

            const dto = mapDocToDto(doc, SampleDto, ['id', 'name', 'optional'])

            expect(dto).toEqual({ id: expect.any(String), name: 'name', optional: undefined })
        })
    })
})
