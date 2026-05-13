import { BadRequestException, Logger } from '@nestjs/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { model, Types } from 'mongoose'
import { createCrudSchema, CrudSchema } from '../crud.schema'
import {
    assignIfDefined,
    isDuplicateKeyError,
    mapDocToDto,
    newObjectIdString,
    objectId,
    objectIds,
    QueryBuilder
} from '../mongoose.util'

describe('newObjectIdString', () => {
    it('새 ObjectId를 24자리 16진 문자열로 반환한다', () => {
        const id = newObjectIdString()
        expect(id).toMatch(/^[0-9a-f]{24}$/)
    })

    it('호출할 때마다 다른 값을 반환한다', () => {
        expect(newObjectIdString()).not.toBe(newObjectIdString())
    })
})

describe('objectId', () => {
    it('유효한 문자열을 ObjectId로 변환한다', () => {
        const idString = '507f1f77bcf86cd799439011'
        const result = objectId(idString)

        expect(result).toBeInstanceOf(Types.ObjectId)
        expect(result.toString()).toBe(idString)
    })

    it('유효하지 않은 문자열이면 예외를 던진다', () => {
        const invalidId = 'invalid-id'

        expect(() => objectId(invalidId)).toThrow(
            'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
        )
    })
})

describe('objectIds', () => {
    it('모든 id가 유효하면 ObjectId 배열로 변환한다', () => {
        const idStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
        const result = objectIds(idStrings)

        expect(result.map((id) => id.toString())).toEqual(idStrings)
        expect(result).toEqual([expect.any(Types.ObjectId), expect.any(Types.ObjectId)])
    })

    it('빈 배열이면 빈 배열을 반환한다', () => {
        const result = objectIds([])

        expect(result).toEqual([])
    })

    it('id 중 하나라도 유효하지 않으면 예외를 던진다', () => {
        const idStrings = ['507f1f77bcf86cd799439011', 'invalid-id']

        expect(() => objectIds(idStrings)).toThrow(
            'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
        )
    })
})

describe('QueryBuilder', () => {
    type TestModel = { _id: Types.ObjectId; createdAt: Date; entityId: string; name: string }

    let builder: QueryBuilder<TestModel>

    beforeEach(() => {
        builder = new QueryBuilder<TestModel>()
    })

    describe('addEquals', () => {
        it('값이 있으면 조건을 추가한다', () => {
            builder.addEquals('name', 'test')
            expect(builder.build({})).toEqual({ name: 'test' })
        })

        it('값이 null이거나 undefined이면 조건을 추가하지 않는다', () => {
            builder.addEquals('name', undefined)
            builder.addEquals('name', null)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })

        it('0, false, 빈 문자열처럼 null이나 undefined가 아닌 값은 조건에 추가된다', () => {
            builder.addEquals('name', 0 as any)
            expect(builder.build({})).toEqual({ name: 0 })

            const b2 = new QueryBuilder<TestModel>()
            b2.addEquals('name', false as any)
            expect(b2.build({})).toEqual({ name: false })

            const b3 = new QueryBuilder<TestModel>()
            b3.addEquals('name', '')
            expect(b3.build({})).toEqual({ name: '' })
        })
    })

    describe('addId', () => {
        it('id가 있으면 ObjectId 조건을 추가한다', () => {
            const id = new Types.ObjectId().toString()
            builder.addId('_id', id)
            expect(builder.build({})).toEqual({ _id: objectId(id) })
        })

        it('id가 없으면 조건을 추가하지 않는다', () => {
            builder.addId('_id', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addIn', () => {
        it('ids가 있으면 $in 조건을 추가한다', () => {
            builder.addIn('entityId', ['123', '456'])
            expect(builder.build({})).toEqual({ entityId: { $in: ['123', '456'] } })
        })

        it('ids에 중복이 있으면 중복을 제거한다', () => {
            jest.spyOn(Logger, 'warn').mockImplementation(() => {})
            builder.addIn('entityId', ['123', '123'])
            expect(builder.build({})).toEqual({ entityId: { $in: ['123'] } })
        })

        it('ids가 비어 있거나 없으면 조건을 추가하지 않는다', () => {
            builder.addIn('entityId', [])
            builder.addIn('entityId', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('addRegex', () => {
        it('값이 있으면 정규식 조건을 추가한다', () => {
            builder.addRegex('name', 'test')
            expect(builder.build({})).toEqual({ name: new RegExp('test', 'i') })
        })

        it('값이 없으면 조건을 추가하지 않는다', () => {
            builder.addRegex('name', undefined)
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })

        it('prefix:true이면 정규식을 문자열 시작 위치에 고정한다', () => {
            builder.addRegex('name', 'hello', { prefix: true })
            expect(builder.build({})).toEqual({ name: new RegExp('^hello', 'i') })
        })

        it('prefix:true이면 정규식 메타문자를 이스케이프한다', () => {
            builder.addRegex('name', 'a.b*', { prefix: true })
            expect(builder.build({})).toEqual({ name: new RegExp('^a\\.b\\*', 'i') })
        })

        it('caseSensitive:true이면 i 플래그를 제거한다', () => {
            builder.addRegex('name', 'test', { caseSensitive: true })
            expect(builder.build({})).toEqual({ name: new RegExp('test') })
        })

        it('prefix와 caseSensitive를 함께 주면 둘 다 적용된다', () => {
            builder.addRegex('name', 'test', { prefix: true, caseSensitive: true })
            expect(builder.build({})).toEqual({ name: new RegExp('^test') })
        })

        it('정규식 메타문자가 포함된 값도 escape되어 정규식 주입을 차단한다', () => {
            builder.addRegex('name', '.*')
            // .* 메타문자가 그대로 들어가면 모든 값에 매칭되겠지만, escape되어 리터럴로 처리됩니다.
            expect(builder.build({})).toEqual({ name: new RegExp('\\.\\*', 'i') })
        })

        it('prefix:true와 정규식 메타문자를 함께 써도 이스케이프한 뒤 시작 위치에 고정한다', () => {
            builder.addRegex('name', '.*', { prefix: true })
            expect(builder.build({})).toEqual({ name: new RegExp('^\\.\\*', 'i') })
        })
    })

    describe('addRange', () => {
        it('start와 end가 모두 있으면 $gte와 $lte를 추가한다', () => {
            const range = { end: new Date('2023-12-31'), start: new Date('2023-01-01') }
            builder.addRange('createdAt', range)
            expect(builder.build({})).toEqual({ createdAt: { $gte: range.start, $lte: range.end } })
        })

        it('start만 있으면 $gte만 추가한다', () => {
            const range = { start: new Date('2023-01-01') }
            builder.addRange('createdAt', range)
            expect(builder.build({})).toEqual({ createdAt: { $gte: range.start } })
        })

        it('end만 있으면 $lte만 추가한다', () => {
            const range = { end: new Date('2023-12-31') }
            builder.addRange('createdAt', range)
            expect(builder.build({})).toEqual({ createdAt: { $lte: range.end } })
        })

        it('range가 비어 있거나 없으면 조건을 추가하지 않는다', () => {
            builder.addRange('createdAt', undefined)
            builder.addRange('createdAt', {})
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })

        it('start와 end가 같으면 $gte와 $lte 모두 같은 값으로 빌드된다', () => {
            const sameDate = new Date('2023-06-15T12:00:00Z')
            builder.addRange('createdAt', { end: sameDate, start: sameDate })

            expect(builder.build({})).toEqual({ createdAt: { $gte: sameDate, $lte: sameDate } })
        })
    })

    describe('build', () => {
        it('조건이 있으면 쿼리 객체를 반환한다', () => {
            builder.addEquals('name', 'test')
            expect(builder.build({})).toEqual({ name: 'test' })
        })

        it('조건이 없으면 BadRequestException을 던진다', () => {
            expect(() => builder.build({})).toThrow(BadRequestException)
        })

        it('allowEmpty:true이면 조건이 없어도 빈 쿼리를 반환한다', () => {
            expect(builder.build({ allowEmpty: true })).toEqual({})
        })
    })
})

describe('mapDocToDto', () => {
    @Schema({ toJSON: { virtuals: true } })
    class Sample extends CrudSchema {
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

    const sampleSchema = createCrudSchema(Sample)
    const SampleModel = model<Sample>('SampleForTest', sampleSchema)

    it('lean 결과 객체를 DTO로 매핑한다', () => {
        const doc = new SampleModel({ name: 'name', optional: undefined }).toJSON()

        const dto = mapDocToDto(doc, SampleDto, ['id', 'name', 'optional'])

        expect(dto).toEqual({ id: expect.any(String), name: 'name', optional: undefined })
    })

    it('keys 목록에 없는 필드는 DTO에 포함되지 않는다', () => {
        const doc = new SampleModel({ name: 'name', optional: true }).toJSON()

        const dto = mapDocToDto(doc, SampleDto, ['id', 'name'])

        expect(dto).toEqual({ id: expect.any(String), name: 'name' })
        expect((dto as any).optional).toBeUndefined()
    })
})

describe('isDuplicateKeyError', () => {
    it('code가 11000이면 true를 반환한다', () => {
        expect(isDuplicateKeyError({ code: 11000, message: 'duplicate' })).toBe(true)
    })

    it('code가 11000이 아니면 false를 반환한다', () => {
        expect(isDuplicateKeyError({ code: 121 })).toBe(false)
    })

    it('code 속성이 없으면 false를 반환한다', () => {
        expect(isDuplicateKeyError({ message: 'boom' })).toBe(false)
    })

    it('null이거나 원시 타입이면 false를 반환한다', () => {
        expect(isDuplicateKeyError(null)).toBe(false)
        expect(isDuplicateKeyError(undefined)).toBe(false)
        expect(isDuplicateKeyError('error')).toBe(false)
        expect(isDuplicateKeyError(11000)).toBe(false)
    })
})

describe('assignIfDefined', () => {
    it('source[key]가 정의되어 있으면 target[key]에 할당한다', () => {
        const target = { name: 'old' }
        const source = { name: 'new' as string | undefined }

        assignIfDefined(target, source, 'name')

        expect(target.name).toBe('new')
    })

    it('source[key]가 undefined이면 target을 변경하지 않는다', () => {
        const target = { name: 'old' }
        const source = { name: undefined as string | undefined }

        assignIfDefined(target, source, 'name')

        expect(target.name).toBe('old')
    })

    it('transform이 주어지면 변환된 값을 할당한다', () => {
        const target = { id: 'old' }
        const source = { id: '123' as string | undefined }

        assignIfDefined(target, source, 'id', (v) => `obj:${v}`)

        expect(target.id).toBe('obj:123')
    })

    it('source[key]가 null이면 null을 정의된 값으로 취급해 그대로 할당한다', () => {
        const target = { email: 'old' as null | string }
        const source = { email: null as null | string | undefined }

        assignIfDefined(target, source, 'email')

        expect(target.email).toBeNull()
    })
})
