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
    // 문자열이 유효한 경우
    describe('when the string is valid', () => {
        // ObjectId로 변환한다
        it('converts to an ObjectId', () => {
            const idString = '507f1f77bcf86cd799439011'
            const result = objectId(idString)

            expect(result).toBeInstanceOf(Types.ObjectId)
            expect(result.toString()).toBe(idString)
        })
    })

    // 문자열이 유효하지 않은 경우
    describe('when the string is invalid', () => {
        // 예외를 던진다
        it('throws an error', () => {
            const invalidId = 'invalid-id'

            expect(() => objectId(invalidId)).toThrow(
                'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
            )
        })
    })
})

describe('objectIds', () => {
    // 모든 ID가 유효한 경우
    describe('when all ids are valid', () => {
        // ObjectId 배열을 반환한다
        it('returns ObjectIds', () => {
            const idStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
            const result = objectIds(idStrings)

            expect(result.map((id) => id.toString())).toEqual(idStrings)
            expect(result).toEqual([expect.any(Types.ObjectId), expect.any(Types.ObjectId)])
        })
    })

    // 빈 배열인 경우
    describe('when ids are empty', () => {
        // 빈 배열을 반환한다
        it('returns an empty array', () => {
            const result = objectIds([])

            expect(result).toEqual([])
        })
    })

    // 유효하지 않은 ID가 포함된 경우
    describe('when any id is invalid', () => {
        // 예외를 던진다
        it('throws an error', () => {
            const idStrings = ['507f1f77bcf86cd799439011', 'invalid-id']

            expect(() => objectIds(idStrings)).toThrow(
                'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
            )
        })
    })
})

describe('QueryBuilder', () => {
    interface TestModel {
        _id: Types.ObjectId
        name: string
        createdAt: Date
    }

    let builder: QueryBuilder<TestModel>

    beforeEach(() => {
        builder = new QueryBuilder<TestModel>()
    })

    describe('addEqual', () => {
        // 값이 유효한 경우
        describe('when value is provided', () => {
            // 쿼리에 추가한다
            it('adds the condition', () => {
                builder.addEqual('name', 'test')
                expect(builder.build({})).toEqual({ name: 'test' })
            })
        })

        // 값이 undefined 또는 null인 경우
        describe('when value is undefined or null', () => {
            // 추가하지 않는다
            it('does not add the condition', () => {
                builder.addEqual('name', undefined)
                builder.addEqual('name', null)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addId', () => {
        // ID가 유효한 경우
        describe('when id is provided', () => {
            // ObjectId로 변환하여 추가한다
            it('adds the ObjectId condition', () => {
                const id = new Types.ObjectId().toString()
                builder.addId('_id', id)
                expect(builder.build({})).toEqual({ _id: objectId(id) })
            })
        })

        // ID가 없는 경우
        describe('when id is undefined', () => {
            // 추가하지 않는다
            it('does not add the condition', () => {
                builder.addId('_id', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addIn', () => {
        // ID 배열이 유효한 경우
        describe('when ids are provided', () => {
            // $in 조건을 추가한다
            it('adds an $in condition', () => {
                const ids = [new Types.ObjectId().toString(), new Types.ObjectId().toString()]
                builder.addIn('_id', ids)
                expect(builder.build({})).toEqual({ _id: { $in: objectIds(ids) } })
            })
        })

        // ID가 중복된 경우
        describe('when ids contain duplicates', () => {
            // 중복을 제거한다
            it('removes duplicates', () => {
                jest.spyOn(Logger, 'error').mockImplementation(() => {})

                const id = new Types.ObjectId().toString()
                const ids = [id, new Types.ObjectId().toString(), id]

                builder.addIn('_id', ids)
                expect(builder.build({})).toEqual({ _id: { $in: objectIds([id, ids[1]]) } })
            })
        })

        // 배열이 비어있거나 undefined인 경우
        describe('when ids are empty or undefined', () => {
            // 추가하지 않는다
            it('does not add the condition', () => {
                builder.addIn('_id', [])
                builder.addIn('_id', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addRegex', () => {
        // 값이 유효한 경우
        describe('when value is provided', () => {
            // 정규식을 추가한다
            it('adds a regex condition', () => {
                builder.addRegex('name', 'test')
                expect(builder.build({})).toEqual({ name: new RegExp('test', 'i') })
            })
        })

        // 값이 없는 경우
        describe('when value is undefined', () => {
            // 추가하지 않는다
            it('does not add the condition', () => {
                builder.addRegex('name', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addRange', () => {
        // start와 end가 모두 있는 경우
        describe('when start and end are provided', () => {
            // $gte와 $lte를 추가한다
            it('adds $gte and $lte conditions', () => {
                const range = { start: new Date('2023-01-01'), end: new Date('2023-12-31') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({
                    createdAt: { $gte: range.start, $lte: range.end }
                })
            })
        })

        // start만 있는 경우
        describe('when only start is provided', () => {
            // $gte를 추가한다
            it('adds only $gte', () => {
                const range = { start: new Date('2023-01-01') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({ createdAt: { $gte: range.start } })
            })
        })

        // end만 있는 경우
        describe('when only end is provided', () => {
            // $lte를 추가한다
            it('adds only $lte', () => {
                const range = { end: new Date('2023-12-31') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({ createdAt: { $lte: range.end } })
            })
        })

        // 값이 없거나 비어있는 경우
        describe('when range is undefined or empty', () => {
            // 추가하지 않는다
            it('does not add the condition', () => {
                builder.addRange('createdAt', undefined)
                builder.addRange('createdAt', {})
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('build', () => {
        // 조건이 있는 경우
        describe('when conditions exist', () => {
            // 쿼리 객체를 반환한다
            it('returns the query object', () => {
                builder.addEqual('name', 'test')
                expect(builder.build({})).toEqual({ name: 'test' })
            })
        })

        // 조건이 없는 경우
        describe('when no conditions exist', () => {
            // 예외를 던진다
            it('throws BadRequestException', () => {
                expect(() => builder.build({})).toThrow(BadRequestException)
            })
        })

        // allowEmpty가 true인 경우
        describe('when allowEmpty is true', () => {
            // 빈 쿼리를 허용한다
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

    // 문서를 DTO로 변환하는 경우
    describe('when mapping a document to a DTO', () => {
        // DTO를 반환한다
        it('returns the DTO', () => {
            const doc = new SampleModel({ name: 'name', optional: undefined })

            const dto = mapDocToDto(doc, SampleDto, ['id', 'name', 'optional'])

            expect(dto).toEqual({ id: expect.any(String), name: 'name', optional: undefined })
        })
    })
})
