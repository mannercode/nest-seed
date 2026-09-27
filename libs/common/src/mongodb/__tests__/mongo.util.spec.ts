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

    it('문자열은 ObjectId로 바꾸고 이미 ObjectId이면 그대로 반환한다', () => {
        const id = new ObjectId()

        expect(objectId(id)).toBe(id)
        expect(objectId(id.toHexString())).toEqual(id)
        expect(objectIds([id, id.toHexString()])).toEqual([id, id])
        expect(objectIds([])).toEqual([])
    })

    it('유효하지 않은 ID 문자열을 변환하면 예외를 던진다', () => {
        expect(() => objectId('invalid-id')).toThrow(BadRequestException)
        expect(() => objectIds([newObjectIdString(), 'invalid-id'])).toThrow('not a valid ObjectId')
    })
})

describe('mongoToPublic, mongoArrayToPublic, withoutPublicId, encodeMongoValues, plainDateFromMongo', () => {
    it.each(['buddhist', 'japanese', 'hebrew'])(
        '%s 달력의 날짜를 BSON으로 왕복하거나 직접 복원해도 같은 ISO 날짜를 유지한다',
        (calendar) => {
            const date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)

            const stored = encodeMongoValues(date) as Date
            const restored = plainDateFromMongo(stored)
            const native = plainDateFromMongo(date)

            expect(stored.toISOString()).toBe('2025-01-01T00:00:00.000Z')
            expect(restored.toString()).toBe('2025-01-01')
            expect(restored.calendarId).toBe('iso8601')
            expect(native.equals(restored)).toBe(true)
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

    it('mongoToPublic에 null을 전달하면 null을 반환한다', () => {
        expect(mongoToPublic(null)).toBeNull()
    })
    it('문서 배열을 변환하면 각 ObjectId를 문자열 ID로 반환한다', () => {
        const _id = new ObjectId()
        expect(mongoArrayToPublic<{ id: string }>([{ _id }, { _id: new ObjectId() }])).toEqual([
            { id: _id.toHexString() },
            { id: expect.any(String) }
        ])
    })

    it('projection으로 제외한 ID를 만들지 않는다', () => {
        expect(mongoToPublic({ name: 'sample' })).toEqual({ name: 'sample' })
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

    it('Instant와 PlainDate를 의미에 맞는 BSON Date로 저장한다', () => {
        const at = Temporal.Instant.from('2025-01-01T12:34:56.789Z')
        const date = Temporal.PlainDate.from('2025-01-01')

        expect(encodeMongoValues({ at, date })).toEqual({
            at: new Date('2025-01-01T12:34:56.789Z'),
            date: new Date('2025-01-01T00:00:00.000Z')
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

    it('BSON Date와 이미 정규화된 값을 PlainDate로 변환한다', () => {
        const current = Temporal.PlainDate.from('2025-01-01')
        const instant = Temporal.Instant.from('2025-01-01T00:00:00.000Z')

        expect(plainDateFromMongo(current)).toBe(current)
        expect(plainDateFromMongo(instant).toString()).toBe('2025-01-01')
        expect(plainDateFromMongo(new Date('2025-01-01T00:00:00.000Z')).toString()).toBe(
            '2025-01-01'
        )
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

    it.each([
        { label: 'undefined', value: undefined },
        { label: 'null', value: null }
    ])('$label로 동등 조건을 추가하면 그 조건을 생략한다', ({ value }) => {
        expect(builder.addEquals('value', value).build({ allowEmpty: true })).toEqual({})
    })
    it.each([0, false, ''])('값이 %j인 동등 조건을 그대로 유지한다', (value) => {
        expect(builder.addEquals('value', value).build()).toEqual({ value })
    })

    it('ID 문자열로 조건을 추가하면 ObjectId로 변환한다', () => {
        const id = newObjectIdString()
        expect(builder.addId('_id', id).build()).toEqual({ _id: objectId(id) })
    })
    it('ID를 생략하면 조건을 추가하지 않는다', () => {
        expect(builder.addId('_id').build({ allowEmpty: true })).toEqual({})
    })

    it('in 조건의 값이 중복되면 중복을 제거하고 경고를 기록한다', () => {
        const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined)
        expect(builder.addIn('entityId', ['a', 'a', 'b']).build()).toEqual({
            entityId: { $in: ['a', 'b'] }
        })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Duplicate entityId'))
    })
    it('빈 in 목록은 유지하고 생략한 목록은 조건에서 제외한다', () => {
        expect(builder.addIn('x', []).addIn('y').build()).toEqual({ x: { $in: [] } })
    })

    it.each([
        {
            label: '양끝',
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
            label: '시작',
            range: { start: Temporal.Instant.from('2025-01-01T00:00:00Z') },
            expected: { $gte: new Date('2025-01-01T00:00:00Z') }
        },
        {
            label: '끝',
            range: { end: Temporal.Instant.from('2025-01-02T00:00:00Z') },
            expected: { $lte: new Date('2025-01-02T00:00:00Z') }
        }
    ])('날짜 범위의 $label 값을 전달하면 해당 경계를 조건에 포함한다', ({ range, expected }) => {
        expect(builder.addRange('at', range).build()).toEqual({ at: expected })
    })
    it.each([
        { label: '미지정', range: undefined },
        { label: '빈 객체', range: {} }
    ])('날짜 범위가 $label이면 조건을 추가하지 않는다', ({ range }) => {
        expect(builder.addRange('at', range).build({ allowEmpty: true })).toEqual({})
    })

    it.each([
        { label: '기본 옵션', value: '.*', options: undefined, expected: /\.\*/i },
        { label: '접두어 옵션', value: 'a.b', options: { prefix: true }, expected: /^a\.b/i },
        {
            label: '대소문자 구분 옵션',
            value: 'Text',
            options: { caseSensitive: true },
            expected: /Text/
        },
        {
            label: '접두어와 대소문자 구분 옵션',
            value: 'Text',
            options: { caseSensitive: true, prefix: true },
            expected: /^Text/
        }
    ])(
        '$label으로 정규식 조건을 만들면 특수문자를 이스케이프하고 옵션을 적용한다',
        ({ value, options, expected }) => {
            expect(builder.addRegex('name', value, options).build()).toEqual({ name: expected })
        }
    )
    it('정규식 값을 생략하면 조건을 추가하지 않는다', () => {
        expect(builder.addRegex('name').build({ allowEmpty: true })).toEqual({})
    })

    it('빈 필터를 만들면 기본적으로 예외를 던진다', () => {
        expect(() => builder.build()).toThrow(BadRequestException)
    })
    it('allowEmpty를 지정하면 빈 필터를 반환한다', () => {
        expect(builder.build({ allowEmpty: true })).toEqual({})
    })
})

describe('isDuplicateKeyError', () => {
    it.each([
        { label: '중복 키 코드 11000', input: { code: 11000 }, expected: true },
        { label: '다른 오류 코드', input: { code: 121 }, expected: false },
        { label: '코드 없는 객체', input: { message: 'error' }, expected: false },
        { label: 'null', input: null, expected: false },
        { label: '문자열', input: 'error', expected: false }
    ])('$label 입력의 중복 키 오류 여부를 판별한다', ({ input, expected }) => {
        expect(isDuplicateKeyError(input)).toBe(expected)
    })
})

describe('assignIfDefined, mapDocToDto', () => {
    const SampleSchema = z.strictObject({
        id: z.string(),
        name: z.string(),
        optional: z.boolean().optional()
    })

    it('정의된 값과 null을 복사하고 undefined는 생략하며 transform을 지원한다', () => {
        const target = { email: 'old' as null | string, id: 'old', name: 'old' }

        assignIfDefined(target, { name: 'new' }, 'name')
        assignIfDefined(target, { email: null as null | string | undefined }, 'email')
        assignIfDefined(target, { id: '123' }, 'id', (id) => `obj:${id}`)
        assignIfDefined(target, { name: undefined as string | undefined }, 'name')

        expect(target).toEqual({ email: null, id: 'obj:123', name: 'new' })
    })

    it('transform의 인자 타입과 실제 전달 값에 null을 포함한다', () => {
        const source = { name: null as string | null | undefined }
        const target = { name: 'old' }

        assignIfDefined(target, source, 'name', (value) => {
            expectTypeOf(value).toEqualTypeOf<string | null>()
            expect(value).toBeNull()
            return value === null ? 'empty' : value.toUpperCase()
        })

        expect(target.name).toBe('empty')
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
