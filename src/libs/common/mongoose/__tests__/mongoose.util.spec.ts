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
    // 문자열을 ObjectId로 변환해야 한다
    it('Should convert a string to an ObjectId', () => {
        const idString = '507f1f77bcf86cd799439011'
        const result = objectId(idString)

        expect(result).toBeInstanceOf(Types.ObjectId)
        expect(result.toString()).toBe(idString)
    })

    // 유효하지 않은 ObjectId 문자열에 대해 예외를 던져야 한다
    it('Should throw an exception for an invalid ObjectId string', () => {
        const invalidId = 'invalid-id'

        expect(() => objectId(invalidId)).toThrow(
            'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
        )
    })
})

describe('objectIds', () => {
    // 문자열 배열을 ObjectId 배열로 변환해야 한다
    it('Should convert an array of string IDs to an array of ObjectIds', () => {
        const idStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
        const result = objectIds(idStrings)

        expect(result.map((id) => id.toString())).toEqual(idStrings)
        expect(result).toEqual([expect.any(Types.ObjectId), expect.any(Types.ObjectId)])
    })

    // 빈 배열이 주어지면 빈 배열을 반환해야 한다
    it('Should return an empty array if an empty array is given', () => {
        const result = objectIds([])

        expect(result).toEqual([])
    })

    // 배열에 유효하지 않은 문자열이 있으면 예외를 던져야 한다
    it('Should throw an exception if any invalid ID string is included', () => {
        const idStrings = ['507f1f77bcf86cd799439011', 'invalid-id']

        expect(() => objectIds(idStrings)).toThrow(
            'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
        )
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
        // 유효한 값이 주어지면 쿼리에 추가해야 한다
        it('Should add to the query if a valid value is provided', () => {
            builder.addEqual('name', 'test')
            expect(builder.build({})).toEqual({ name: 'test' })
        })

        // undefined나 null이면 쿼리에 추가하지 않아야 한다
        it('Should not add anything if the value is undefined or null', () => {
            builder.addEqual('name', undefined)
            builder.addEqual('name', null)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addId', () => {
        // 유효한 ID가 주어지면 ObjectId로 변환되어 쿼리에 추가해야 한다
        it('Should convert a valid ID string to ObjectId and add it to the query', () => {
            const id = new Types.ObjectId().toString()
            builder.addId('_id', id)
            expect(builder.build({})).toEqual({ _id: objectId(id) })
        })

        // undefined이면 쿼리에 추가하지 않아야 한다
        it('Should not add anything if the value is undefined', () => {
            builder.addId('_id', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addIn', () => {
        // 유효한 ID 배열이 주어지면 $in 조건을 쿼리에 추가해야 한다
        it('Should add an $in condition if a valid array of IDs is provided', () => {
            const ids = [new Types.ObjectId().toString(), new Types.ObjectId().toString()]
            builder.addIn('_id', ids)
            expect(builder.build({})).toEqual({ _id: { $in: objectIds(ids) } })
        })

        // 중복된 ID가 있으면 중복을 제거해야 한다
        it('Should remove duplicates if there are repeated IDs', () => {
            jest.spyOn(Logger, 'error').mockImplementation(() => {})

            const id = new Types.ObjectId().toString()
            const ids = [id, new Types.ObjectId().toString(), id]

            builder.addIn('_id', ids)
            expect(builder.build({})).toEqual({ _id: { $in: objectIds([id, ids[1]]) } })
        })

        // 빈 배열이나 undefined이면 쿼리에 추가하지 않아야 한다
        it('Should not add anything if the array is empty or undefined', () => {
            builder.addIn('_id', [])
            builder.addIn('_id', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addRegex', () => {
        // 유효한 문자열이 주어지면 정규 표현식을 쿼리에 추가해야 한다
        it('Should add a regex query if a valid string is provided', () => {
            builder.addRegex('name', 'test')
            expect(builder.build({})).toEqual({ name: new RegExp('test', 'i') })
        })

        // undefined이면 쿼리에 추가하지 않아야 한다
        it('Should not add anything if the value is undefined', () => {
            builder.addRegex('name', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addRange', () => {
        // start와 end가 주어지면 $gte와 $lte를 쿼리에 추가해야 한다
        it('Should add $gte and $lte if both start and end are provided', () => {
            const range = { start: new Date('2023-01-01'), end: new Date('2023-12-31') }
            builder.addRange('createdAt', range)
            expect(builder.build({})).toEqual({ createdAt: { $gte: range.start, $lte: range.end } })
        })

        // start만 주어지면 $gte를 쿼리에 추가해야 한다
        it('Should add only $gte if only start is provided', () => {
            const range = { start: new Date('2023-01-01') }
            builder.addRange('createdAt', range)
            expect(builder.build({})).toEqual({ createdAt: { $gte: range.start } })
        })

        // end만 주어지면 $lte를 쿼리에 추가해야 한다
        it('Should add only $lte if only end is provided', () => {
            const range = { end: new Date('2023-12-31') }
            builder.addRange('createdAt', range)
            expect(builder.build({})).toEqual({ createdAt: { $lte: range.end } })
        })

        // undefined이면 쿼리에 추가하지 않아야 한다
        it('Should not add anything if the value is undefined', () => {
            builder.addRange('createdAt', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })

        // 빈 객체면 쿼리에 추가하지 않아야 한다
        it('Should not add anything if the value is empty object', () => {
            builder.addRange('createdAt', {})
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('build', () => {
        // 추가된 조건이 있으면 쿼리 객체를 반환해야 한다
        it('Should return a query object if conditions have been added', () => {
            builder.addEqual('name', 'test')
            expect(builder.build({})).toEqual({ name: 'test' })
        })

        // 조건이 없으면 BadRequestException을 던져야 한다
        it('Should throw a BadRequestException if no conditions are present', () => {
            expect(() => builder.build({})).toThrow(BadRequestException)
        })

        // allowEmpty가 true면 빈 쿼리를 허용한다
        it('Should allow an empty query if allowEmpty is true', () => {
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

    // 문서를 DTO로 변환해야 합니다
    it('Should convert a document to a DTO', () => {
        const doc = new SampleModel({ name: 'name', optional: undefined })

        const dto = mapDocToDto(doc, SampleDto, ['id', 'name', 'optional'])

        expect(dto).toEqual({ id: expect.any(String), name: 'name', optional: undefined })
    })
})
