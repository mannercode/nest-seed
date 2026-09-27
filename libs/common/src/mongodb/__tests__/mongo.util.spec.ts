import { assignIfDefined, mapDocToDto } from '../../utils/index.js'
import { z } from 'zod'
import { BadRequestException, Logger } from '@nestjs/common'
import { Decimal128, ObjectId } from 'mongodb'
import {
    decodeMongoValues,
    encodeMongoDocument,
    encodeMongoValues,
    isDuplicateKeyError,
    mongoArrayToPublic,
    mongoToPublic,
    newObjectIdString,
    objectId,
    objectIds,
    plainDateFromMongo,
    QueryBuilder,
    withoutPublicId
} from '../index.js'

describe('newObjectIdString, objectId, objectIds', () => {
    it('새로운 문자열 ObjectId를 만든다', () => {
        const first = newObjectIdString()
        const second = newObjectIdString()

        expect(first).toMatch(/^[0-9a-f]{24}$/)
        expect(second).not.toBe(first)
    })

    describe('입력이 ObjectId 객체이면', () => {
        let id: ObjectId
        beforeEach(() => {
            id = new ObjectId()
        })
        it('ObjectId로 변환하면 같은 객체를 반환한다', () => {
            expect(objectId(id)).toBe(id)
        })
    })
    describe('입력이 유효한 ID 문자열이면', () => {
        let id: ObjectId
        let input: string
        beforeEach(() => {
            id = new ObjectId()
            input = id.toHexString()
        })
        it('ObjectId로 변환하면 같은 ID의 객체를 반환한다', () => {
            expect(objectId(input)).toEqual(id)
        })
    })
    describe('목록에 ObjectId와 ID 문자열이 섞여 있으면', () => {
        let id: ObjectId
        let input: (ObjectId | string)[]
        beforeEach(() => {
            id = new ObjectId()
            input = [id, id.toHexString()]
        })
        it('ID 목록을 변환하면 모든 항목을 ObjectId로 반환한다', () => {
            expect(objectIds(input)).toEqual([id, id])
        })
    })
    describe('ID 목록이 비어 있으면', () => {
        let input: string[]
        beforeEach(() => {
            input = []
        })
        it('ID 목록을 변환하면 빈 배열을 반환한다', () => {
            expect(objectIds(input)).toEqual([])
        })
    })

    describe('유효하지 않은 ID 문자열이 있으면', () => {
        let invalidId: string
        let ids: string[]
        beforeEach(() => {
            invalidId = 'invalid-id'
            ids = [newObjectIdString(), invalidId]
        })
        it('ObjectId로 변환하면 BadRequestException을 던진다', () => {
            expect(() => objectId(invalidId)).toThrow(BadRequestException)
        })
        it('해당 ID가 포함된 목록을 변환하면 예외를 던진다', () => {
            expect(() => objectIds(ids)).toThrow('not a valid ObjectId')
        })
    })
})

describe('mongoToPublic, mongoArrayToPublic, withoutPublicId, encodeMongoValues, plainDateFromMongo', () => {
    describe.each(['buddhist', 'japanese', 'hebrew'])(
        '날짜가 %s 달력으로 표현되어 있으면',
        (calendar) => {
            let date: Temporal.PlainDate
            beforeEach(() => {
                date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)
            })
            it('BSON 저장·복원과 직접 복원 모두 같은 ISO 날짜를 반환한다', () => {
                const stored = encodeMongoValues(date) as Date
                const restored = plainDateFromMongo(stored)
                const native = plainDateFromMongo(date)

                expect(stored.toISOString()).toBe('2025-01-01T00:00:00.000Z')
                expect(restored.toString()).toBe('2025-01-01')
                expect(restored.calendarId).toBe('iso8601')
                expect(native.equals(restored)).toBe(true)
            })
        }
    )

    it('원본을 변경하지 않고 _id를 문자열 id로 교체한다', () => {
        const _id = new ObjectId()
        const doc = { _id, name: 'sample' }

        const mapped = mongoToPublic<{ id: string; name: string }>(doc)

        expect(mapped).toEqual({ id: _id.toHexString(), name: 'sample' })
        expect(doc).toEqual({ _id, name: 'sample' })
        expect(doc._id).toBe(_id)
    })

    describe('변환할 문서가 null이면', () => {
        let document: null
        beforeEach(() => {
            document = null
        })
        it('공개 문서로 변환하면 null을 반환한다', () => {
            expect(mongoToPublic(document)).toBeNull()
        })
    })
    it('문서 배열을 변환하면 각 ObjectId를 문자열 ID로 반환한다', () => {
        const _id = new ObjectId()
        expect(mongoArrayToPublic<{ id: string }>([{ _id }, { _id: new ObjectId() }])).toEqual([
            { id: _id.toHexString() },
            { id: expect.any(String) }
        ])
    })

    describe('변환할 문서에 _id가 없으면', () => {
        let document: { name: string }
        beforeEach(() => {
            document = { name: 'sample' }
        })
        it('공개 문서로 변환해도 id 필드를 추가하지 않는다', () => {
            expect(mongoToPublic(document)).toEqual({ name: 'sample' })
        })
    })

    it('중첩된 ObjectId도 문자열로 반환하고 원본과 다른 BSON 값은 보존한다', () => {
        const _id = new ObjectId()
        const relatedId = new ObjectId()
        const decimal = Decimal128.fromString('12.34')
        const nested = Object.assign(Object.create(null), { relatedId })
        const doc = { _id, decimal, history: [nested, null], relatedId }

        expect(mongoToPublic(doc)).toEqual({
            decimal,
            history: [{ relatedId: relatedId.toHexString() }, null],
            id: _id.toHexString(),
            relatedId: relatedId.toHexString()
        })
        expect(doc.relatedId).toBe(relatedId)
        expect(nested.relatedId).toBe(relatedId)
        expect(decodeMongoValues(decimal)).toBe(decimal)
    })

    it('저장용 복사본에서는 public id만 제거한다', () => {
        const input = { id: 'public', name: 'sample' }

        expect(withoutPublicId(input)).toEqual({ name: 'sample' })
        expect(input).toEqual({ id: 'public', name: 'sample' })
    })

    describe('저장할 객체에 Instant와 PlainDate가 있으면', () => {
        let at: Temporal.Instant
        let date: Temporal.PlainDate
        beforeEach(() => {
            at = Temporal.Instant.from('2025-01-01T12:34:56.789Z')
            date = Temporal.PlainDate.from('2025-01-01')
        })
        it('BSON Date로 변환하면 Instant의 시각을 유지하고 PlainDate는 UTC 자정으로 저장한다', () => {
            expect(encodeMongoValues({ at, date })).toEqual({
                at: new Date('2025-01-01T12:34:56.789Z'),
                date: new Date('2025-01-01T00:00:00.000Z')
            })
        })
    })

    it('DTO class 내부의 Temporal은 변환하고 BSON 원자값은 보존한다', () => {
        class NestedDto {
            at = Temporal.Instant.from('2025-01-01T12:34:56.789Z')
        }

        const id = new ObjectId()
        const decimal = Decimal128.fromString('12.34')
        const customBson = { toBSON: () => ({ value: 'serialized by the driver' }) }
        const encoded = encodeMongoValues({ customBson, decimal, id, nested: new NestedDto() })

        expect(encoded).toEqual({
            customBson,
            decimal,
            id,
            nested: { at: new Date('2025-01-01T12:34:56.789Z') }
        })
        expect(encodeMongoValues(id)).toBe(id)
        expect(encodeMongoValues(decimal)).toBe(decimal)
        expect(encodeMongoValues(customBson)).toBe(customBson)
    })

    it('BSON Date timestamp를 Instant로 복원한다', () => {
        const _id = new ObjectId()
        const mapped = mongoToPublic<{
            at: Temporal.Instant
            history: Array<{ at: Temporal.Instant }>
            id: string
        }>({
            _id,
            at: new Date('2025-01-01T12:34:56.789Z'),
            history: [{ at: new Date('2025-01-01T12:34:56.789Z') }]
        })

        expect(mapped.at).toBeInstanceOf(Temporal.Instant)
        expect(mapped.at.toString()).toBe('2025-01-01T12:34:56.789Z')
        expect(mapped.history[0]?.at).toBeInstanceOf(Temporal.Instant)
    })

    describe('날짜 값이 ISO 달력의 PlainDate이면', () => {
        let current: Temporal.PlainDate
        beforeEach(() => {
            current = Temporal.PlainDate.from('2025-01-01')
        })
        it('날짜를 복원하면 같은 객체를 반환한다', () => {
            expect(plainDateFromMongo(current)).toBe(current)
        })
    })
    describe.each([
        {
            condition: '날짜 값이 Instant이면',
            value: Temporal.Instant.from('2025-01-01T00:00:00.000Z')
        },
        { condition: '날짜 값이 Date 객체이면', value: new Date('2025-01-01T00:00:00.000Z') }
    ])('$condition', ({ value }) => {
        let input: typeof value
        beforeEach(() => {
            input = value
        })
        it('날짜를 복원하면 같은 날짜의 PlainDate를 반환한다', () => {
            expect(plainDateFromMongo(input).toString()).toBe('2025-01-01')
        })
    })
})

describe('MongoDB 문서 값 변환', () => {
    it('필드명이나 조건식에서 ID 타입을 추측하지 않는다', () => {
        const id = newObjectIdString()
        const at = Temporal.Instant.from('2025-01-01T00:00:00Z')
        const document = {
            $and: [{ _id: id }, { _id: { $in: [id] } }],
            $setOnInsert: { _id: id, createdAt: at },
            userId: id
        }
        expect(encodeMongoDocument(document)).toEqual({
            $and: [{ _id: id }, { _id: { $in: [id] } }],
            $setOnInsert: { _id: id, createdAt: new Date('2025-01-01T00:00:00Z') },
            userId: id
        })
        expect(document.$setOnInsert.createdAt).toBe(at)
        expect(encodeMongoDocument({ _id: 'group-key' })).toEqual({ _id: 'group-key' })
    })
})

describe('QueryBuilder', () => {
    let builder: QueryBuilder

    beforeEach(() => {
        builder = new QueryBuilder()
    })

    describe.each([
        { condition: '동등 조건의 값이 undefined이면', value: undefined },
        { condition: '동등 조건의 값이 null이면', value: null }
    ])('$condition', ({ value }) => {
        let input: typeof value
        beforeEach(() => {
            input = value
        })
        it('동등 조건을 추가하면 해당 조건을 생략한다', () => {
            expect(builder.addEquals('value', input).build({ allowEmpty: true })).toEqual({})
        })
    })
    describe.each([0, false, ''])('동등 조건의 값이 %j이면', (value) => {
        let input: typeof value
        beforeEach(() => {
            input = value
        })
        it('동등 조건을 추가하면 해당 값을 유지한다', () => {
            expect(builder.addEquals('value', input).build()).toEqual({ value })
        })
    })

    it('ID 문자열로 조건을 추가하면 ObjectId로 변환한다', () => {
        const id = newObjectIdString()
        expect(builder.addId('_id', id).build()).toEqual({ _id: objectId(id) })
    })
    describe('ID 조건의 값을 지정하지 않았으면', () => {
        let input: Parameters<typeof builder.addId>
        beforeEach(() => {
            input = ['_id']
        })
        it('ID 조건을 추가해도 결과에 포함하지 않는다', () => {
            expect(builder.addId(...input).build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('in 조건의 값에 중복이 있으면', () => {
        let values: Parameters<typeof builder.addIn>[1]
        beforeEach(() => {
            values = ['a', 'a', 'b']
        })
        it('조건을 추가하면 중복을 제거하고 경고를 기록한다', () => {
            const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined)
            expect(builder.addIn('entityId', values).build()).toEqual({
                entityId: { $in: ['a', 'b'] }
            })
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('Duplicate entityId'))
        })
    })
    describe('빈 in 목록과 값을 생략한 in 조건이 있으면', () => {
        let input: Parameters<typeof builder.addIn>
        beforeEach(() => {
            input = ['x', []]
        })
        it('필터를 만들면 빈 목록만 포함하고 생략한 값은 제외한다', () => {
            expect(
                builder
                    .addIn(...input)
                    .addIn('y')
                    .build()
            ).toEqual({ x: { $in: [] } })
        })
    })

    describe.each([
        {
            condition: '날짜 범위에 시작과 끝 시각이 모두 있으면',
            range: {
                start: Temporal.Instant.from('2025-01-01T00:00:00Z'),
                end: Temporal.Instant.from('2025-01-02T00:00:00Z')
            },
            expected: {
                $gte: new Date('2025-01-01T00:00:00Z'),
                $lte: new Date('2025-01-02T00:00:00Z')
            }
        },
        {
            condition: '날짜 범위에 시작 시각만 있으면',
            range: { start: Temporal.Instant.from('2025-01-01T00:00:00Z') },
            expected: { $gte: new Date('2025-01-01T00:00:00Z') }
        },
        {
            condition: '날짜 범위에 끝 시각만 있으면',
            range: { end: Temporal.Instant.from('2025-01-02T00:00:00Z') },
            expected: { $lte: new Date('2025-01-02T00:00:00Z') }
        }
    ])('$condition', ({ range, expected }) => {
        let input: typeof range
        beforeEach(() => {
            input = range
        })
        it('범위 조건을 추가하면 지정한 경계를 조건에 포함한다', () => {
            expect(builder.addRange('at', input).build()).toEqual({ at: expected })
        })
    })
    describe.each([
        { condition: '날짜 범위를 지정하지 않았으면', range: undefined },
        { condition: '날짜 범위가 빈 객체이면', range: {} }
    ])('$condition', ({ range }) => {
        let input: typeof range
        beforeEach(() => {
            input = range
        })
        it('범위 조건을 추가해도 결과에 포함하지 않는다', () => {
            expect(builder.addRange('at', input).build({ allowEmpty: true })).toEqual({})
        })
    })

    describe.each([
        {
            condition: '정규식 검색 옵션을 지정하지 않았으면',
            value: '.*',
            options: undefined,
            expected: /\.\*/i
        },
        {
            condition: '정규식 검색에서 접두어 일치를 지정했으면',
            value: 'a.b',
            options: { prefix: true },
            expected: /^a\.b/i
        },
        {
            condition: '정규식 검색에서 대소문자를 구분하도록 지정했으면',
            value: 'Text',
            options: { caseSensitive: true },
            expected: /Text/
        },
        {
            condition: '정규식 검색에서 접두어 일치와 대소문자 구분을 지정했으면',
            value: 'Text',
            options: { caseSensitive: true, prefix: true },
            expected: /^Text/
        }
    ])('$condition', ({ value, options, expected }) => {
        let input: string
        let regexOptions: typeof options
        beforeEach(() => {
            input = value

            regexOptions = options
        })
        it('정규식 조건을 만들면 특수문자를 이스케이프하고 옵션을 적용한다', () => {
            expect(builder.addRegex('name', input, regexOptions).build()).toEqual({
                name: expected
            })
        })
    })
    describe('정규식 조건의 값을 지정하지 않았으면', () => {
        let input: Parameters<typeof builder.addRegex>
        beforeEach(() => {
            input = ['name']
        })
        it('정규식 조건을 추가해도 결과에 포함하지 않는다', () => {
            expect(builder.addRegex(...input).build({ allowEmpty: true })).toEqual({})
        })
    })

    describe('검색 조건이 비어 있고 빈 필터를 허용하지 않았으면', () => {
        let options: Parameters<typeof builder.build>
        beforeEach(() => {
            options = []
        })
        it('필터를 만들면 예외를 던진다', () => {
            expect(() => builder.build(...options)).toThrow(BadRequestException)
        })
    })
    describe('검색 조건이 비어 있고 allowEmpty가 true이면', () => {
        let options: Parameters<typeof builder.build>[0]
        beforeEach(() => {
            options = { allowEmpty: true }
        })
        it('필터를 만들면 빈 객체를 반환한다', () => {
            expect(builder.build(options)).toEqual({})
        })
    })
})

describe('isDuplicateKeyError', () => {
    describe.each([
        { condition: '오류 코드가 11000이면', input: { code: 11000 }, expected: true },
        { condition: '오류 코드가 11000이 아니면', input: { code: 121 }, expected: false },
        { condition: '오류 객체에 code가 없으면', input: { message: 'error' }, expected: false },
        { condition: '오류 값이 null이면', input: null, expected: false },
        { condition: '오류 값이 문자열이면', input: 'error', expected: false }
    ])('$condition', ({ input, expected }) => {
        let error: typeof input
        beforeEach(() => {
            error = input
        })
        it(`중복 키 오류인지 판별하면 ${expected}를 반환한다`, () => {
            expect(isDuplicateKeyError(error)).toBe(expected)
        })
    })
})

describe('assignIfDefined, mapDocToDto', () => {
    const SampleSchema = z.strictObject({
        id: z.string(),
        name: z.string(),
        optional: z.boolean().optional()
    })

    describe.each([
        {
            condition: '복사할 값이 문자열이면',
            value: 'new',
            initial: 'old',
            expected: 'new',
            result: '새 문자열로 바꾼다'
        },
        {
            condition: '복사할 값이 null이면',
            value: null,
            initial: 'old',
            expected: null,
            result: 'null로 바꾼다'
        },
        {
            condition: '복사할 값이 undefined이면',
            value: undefined,
            initial: 'new',
            expected: 'new',
            result: '기존 값을 유지한다'
        }
    ])('$condition', ({ value, initial, expected, result }) => {
        let source: { name: string | null | undefined }
        let target: { email: string; id: string; name: string | null }
        beforeEach(() => {
            source = { name: value }
            target = { email: 'old', id: 'old', name: initial }
        })
        it(`필드를 복사하면 ${result}`, () => {
            assignIfDefined(target, source, 'name')

            expect(target).toEqual({ email: 'old', id: 'old', name: expected })
        })
    })

    describe('복사할 값이 문자열이고 변환 함수를 지정했으면', () => {
        let source: { id: string }
        let target: { email: string; id: string; name: string }
        let transform: (id: string) => string
        beforeEach(() => {
            source = { id: '123' }
            target = { email: 'old', id: 'old', name: 'old' }
            transform = (id) => `obj:${id}`
        })
        it('필드를 복사하면 변환한 값을 저장한다', () => {
            assignIfDefined(target, source, 'id', transform)

            expect(target).toEqual({ email: 'old', id: 'obj:123', name: 'old' })
        })
    })

    describe('복사할 값이 null이고 변환 함수를 지정했으면', () => {
        let source: { name: string | null | undefined }
        let target: { name: string }
        let transform: (value: string | null) => string
        beforeEach(() => {
            source = { name: null }
            target = { name: 'old' }
            transform = (value) => (value === null ? 'empty' : value.toUpperCase())
        })
        it('필드를 복사하면 null을 변환 함수에 전달하고 변환한 값을 저장한다', () => {
            assignIfDefined(target, source, 'name', (value) => {
                expectTypeOf(value).toEqualTypeOf<string | null>()
                expect(value).toBeNull()
                return transform(value)
            })

            expect(target.name).toBe('empty')
        })
    })

    it('스키마에 선언한 필드만 DTO로 매핑한다', () => {
        const dto = mapDocToDto(
            { extra: true, id: 'id', name: 'name', optional: undefined },
            SampleSchema
        )

        expect(dto).toEqual({ id: 'id', name: 'name', optional: undefined })
        expect(dto).not.toHaveProperty('extra')
    })
})
