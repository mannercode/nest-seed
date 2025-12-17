import { BadRequestException, Logger } from '@nestjs/common'
import { Prop, Schema } from '@nestjs/mongoose'
import {
    createMongooseSchema,
    mapDocToDto,
    MongooseSchema,
    newObjectId,
    objectId,
    objectIds,
    QueryBuilder,
    assignIfDefined
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
    describe('when all ids are valid', () => {
        it('converts them to ObjectIds', () => {
            const idStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
            const result = objectIds(idStrings)

            expect(result.map((id) => id.toString())).toEqual(idStrings)
            expect(result).toEqual([expect.any(Types.ObjectId), expect.any(Types.ObjectId)])
        })
    })

    describe('when ids are empty', () => {
        it('returns an empty array', () => {
            const result = objectIds([])

            expect(result).toEqual([])
        })
    })

    describe('when any id is invalid', () => {
        it('throws', () => {
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

        describe('when the value is not provided', () => {
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

        describe('when the id is not provided', () => {
            it('does not add the condition', () => {
                builder.addId('_id', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addIn', () => {
        describe('when ids are provided', () => {
            it('adds an $in condition', () => {
                const ids = [new Types.ObjectId().toString(), new Types.ObjectId().toString()]
                builder.addIn('_id', ids)
                expect(builder.build({})).toEqual({ _id: { $in: objectIds(ids) } })
            })
        })

        describe('when ids contain duplicates', () => {
            it('removes duplicates', () => {
                jest.spyOn(Logger, 'error').mockImplementation(() => {})

                const id = new Types.ObjectId().toString()
                const ids = [id, new Types.ObjectId().toString(), id]

                builder.addIn('_id', ids)
                expect(builder.build({})).toEqual({ _id: { $in: objectIds([id, ids[1]]) } })
            })
        })

        describe('when ids are empty or not provided', () => {
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

        describe('when the value is not provided', () => {
            it('does not add the condition', () => {
                builder.addRegex('name', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addRange', () => {
        describe('when start and end are provided', () => {
            it('adds $gte and $lte conditions', () => {
                const range = { start: new Date('2023-01-01'), end: new Date('2023-12-31') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({
                    createdAt: { $gte: range.start, $lte: range.end }
                })
            })
        })

        describe('when only start is provided', () => {
            it('adds only $gte', () => {
                const range = { start: new Date('2023-01-01') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({ createdAt: { $gte: range.start } })
            })
        })

        describe('when only end is provided', () => {
            it('adds only $lte', () => {
                const range = { end: new Date('2023-12-31') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({ createdAt: { $lte: range.end } })
            })
        })

        describe('when the range is empty or not provided', () => {
            it('does not add the condition', () => {
                builder.addRange('createdAt', undefined)
                builder.addRange('createdAt', {})
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('build', () => {
        describe('when conditions exist', () => {
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

        describe('when allowEmpty is true', () => {
            it('returns an empty query', () => {
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

    it('maps a document to a DTO', () => {
        const doc = new SampleModel({ name: 'name', optional: undefined })

        const dto = mapDocToDto(doc, SampleDto, ['id', 'name', 'optional'])

        expect(dto).toEqual({ id: expect.any(String), name: 'name', optional: undefined })
    })
})

describe('assignIfDefined', () => {
    describe('when source[key] is defined', () => {
        it('assigns target[key]', () => {
            const target = { name: 'old' }
            const source = { name: 'new' as string | undefined }

            assignIfDefined(target, source, 'name')

            expect(target.name).toBe('new')
        })
    })

    describe('when source[key] is not provided', () => {
        it('does not change target', () => {
            const target = { name: 'old' }
            const source = { name: undefined as string | undefined }

            assignIfDefined(target, source, 'name')

            expect(target.name).toBe('old')
        })
    })

    describe('when transform is provided', () => {
        it('assigns the transformed value', () => {
            const target = { id: 'old' }
            const source = { id: '123' as string | undefined }

            assignIfDefined(target, source, 'id', (v) => `obj:${v}`)

            expect(target.id).toBe('obj:123')
        })
    })

    describe('when source[key] is null', () => {
        it('treats null as defined', () => {
            const target = { email: 'old' as string | null }
            const source = { email: null as string | null | undefined }

            assignIfDefined(target, source, 'email')

            expect(target.email).toBeNull()
        })
    })
})
