import { BadRequestException, Logger } from '@nestjs/common'
import { Decimal128, MongoWriteConcernError, ObjectId } from 'mongodb'
import {
    assignIfDefined,
    encodeMongoValues,
    isDuplicateKeyError,
    isWriteConcernTimeoutError,
    mapDocToDto,
    mongoArrayToPublic,
    mongoToPublic,
    newObjectIdString,
    objectId,
    objectIds,
    plainDateFromMongo,
    QueryBuilder,
    withoutPublicId
} from '../index.js'

describe('ObjectId helpers', () => {
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

    it('유효하지 않은 문자열은 400으로 거부한다', () => {
        expect(() => objectId('invalid-id')).toThrow(BadRequestException)
        expect(() => objectIds([newObjectIdString(), 'invalid-id'])).toThrow('not a valid ObjectId')
    })
})

describe('Mongo document mapping', () => {
    it('ObjectId의 문자열 id를 원본 문서에 추가한다', () => {
        const _id = new ObjectId()
        const doc = { _id, name: 'sample' }

        const mapped = mongoToPublic<{ id: string; name: string }>(doc)

        expect(mapped).toBe(doc)
        expect(mapped).toMatchObject({ id: _id.toHexString(), name: 'sample' })
    })

    it('null과 배열을 처리한다', () => {
        const _id = new ObjectId()

        expect(mongoToPublic(null)).toBeNull()
        expect(mongoArrayToPublic<{ id: string }>([{ _id }, { _id: new ObjectId() }])).toEqual([
            expect.objectContaining({ id: _id.toHexString() }),
            expect.objectContaining({ id: expect.any(String) })
        ])
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

describe('QueryBuilder', () => {
    type TestDocument = {
        _id: ObjectId
        createdAt: Temporal.Instant
        entityId: string
        name: string
    }

    let builder: QueryBuilder<TestDocument>

    beforeEach(() => {
        builder = new QueryBuilder<TestDocument>()
    })

    it('equals는 nullish만 생략하고 falsy 값은 유지한다', () => {
        builder.addEquals('missing', undefined).addEquals('nulled', null)
        expect(builder.build({ allowEmpty: true })).toEqual({})

        expect(new QueryBuilder().addEquals('zero', 0).build()).toEqual({ zero: 0 })
        expect(new QueryBuilder().addEquals('false', false).build()).toEqual({ false: false })
        expect(new QueryBuilder().addEquals('empty', '').build()).toEqual({ empty: '' })
    })

    it('id가 있을 때만 ObjectId 조건을 추가한다', () => {
        const id = newObjectIdString()

        expect(builder.addId('_id', id).build()).toEqual({ _id: objectId(id) })
        expect(new QueryBuilder().addId('_id').build({ allowEmpty: true })).toEqual({})
    })

    it('in 조건의 중복을 제거하고 빈 입력은 생략한다', () => {
        const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined)

        expect(builder.addIn('entityId', ['a', 'a', 'b']).build()).toEqual({
            entityId: { $in: ['a', 'b'] }
        })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Duplicate entityId'))
        expect(new QueryBuilder().addIn('x', []).addIn('y').build({ allowEmpty: true })).toEqual({})
    })

    it('날짜 범위의 양끝 또는 한쪽 끝만 추가한다', () => {
        const start = Temporal.Instant.from('2025-01-01T00:00:00Z')
        const end = Temporal.Instant.from('2025-01-02T00:00:00Z')
        const storedStart = new Date('2025-01-01T00:00:00Z')
        const storedEnd = new Date('2025-01-02T00:00:00Z')

        expect(builder.addRange('createdAt', { end, start }).build()).toEqual({
            createdAt: { $gte: storedStart, $lte: storedEnd }
        })
        expect(new QueryBuilder().addRange('at', { start }).build()).toEqual({
            at: { $gte: storedStart }
        })
        expect(new QueryBuilder().addRange('at', { end }).build()).toEqual({
            at: { $lte: storedEnd }
        })
        expect(
            new QueryBuilder()
                .addRange('a', undefined)
                .addRange('b', {})
                .build({ allowEmpty: true })
        ).toEqual({})
    })

    it('regex 값을 이스케이프하고 옵션을 적용한다', () => {
        expect(builder.addRegex('name', '.*').build()).toEqual({ name: /\.\*/i })
        expect(new QueryBuilder().addRegex('name', 'a.b', { prefix: true }).build()).toEqual({
            name: /^a\.b/i
        })
        expect(
            new QueryBuilder().addRegex('name', 'Text', { caseSensitive: true }).build()
        ).toEqual({ name: /Text/ })
        expect(
            new QueryBuilder()
                .addRegex('name', 'Text', { caseSensitive: true, prefix: true })
                .build()
        ).toEqual({ name: /^Text/ })
        expect(new QueryBuilder().addRegex('name').build({ allowEmpty: true })).toEqual({})
    })

    it('빈 필터는 기본적으로 거부하고 명시한 경우만 허용한다', () => {
        expect(() => builder.build()).toThrow(BadRequestException)
        expect(builder.build({ allowEmpty: true })).toEqual({})
    })
})

describe('Mongo errors', () => {
    it('duplicate key code만 식별한다', () => {
        expect(isDuplicateKeyError({ code: 11000 })).toBe(true)
        expect(isDuplicateKeyError({ code: 121 })).toBe(false)
        expect(isDuplicateKeyError({ message: 'error' })).toBe(false)
        expect(isDuplicateKeyError(null)).toBe(false)
        expect(isDuplicateKeyError('error')).toBe(false)
    })

    it('MongoWriteConcernError와 중첩된 timeout 정보를 식별한다', () => {
        const driverError = new MongoWriteConcernError({
            ok: 1,
            writeConcernError: {
                code: 64,
                codeName: 'WriteConcernFailed',
                errInfo: { wtimeout: true },
                errmsg: 'waiting for replication timed out'
            }
        })

        expect(isWriteConcernTimeoutError(driverError)).toBe(true)
        expect(
            isWriteConcernTimeoutError({
                errorResponse: { codeName: 'WriteConcernFailed', errInfo: { wtimeout: true } }
            })
        ).toBe(true)
        expect(
            isWriteConcernTimeoutError({
                result: {
                    writeConcernError: { code: 64, errmsg: 'waiting for replication timed out' }
                }
            })
        ).toBe(true)
    })

    it('timeout 메시지의 지원 형태와 대소문자를 처리한다', () => {
        expect(isWriteConcernTimeoutError({ code: 64, message: 'WTIMEOUT' })).toBe(true)
        expect(isWriteConcernTimeoutError({ code: 64, message: 'Write Concern Timed Out' })).toBe(
            true
        )
        expect(
            isWriteConcernTimeoutError({
                name: 'MongoWriteConcernError',
                errmsg: 'timed out waiting for replication'
            })
        ).toBe(true)
    })

    it('write concern timeout이 아닌 값과 순환 cause는 거부한다', () => {
        expect(
            isWriteConcernTimeoutError({
                code: 64,
                codeName: 'WriteConcernFailed',
                errInfo: { wtimeout: false },
                message: 'write concern failed'
            })
        ).toBe(false)
        expect(
            isWriteConcernTimeoutError({ errInfo: { wtimeout: true }, name: 'OtherError' })
        ).toBe(false)

        const circular: { cause?: unknown; name: string } = { name: 'OtherError' }
        circular.cause = circular
        expect(isWriteConcernTimeoutError(circular)).toBe(false)
        expect(isWriteConcernTimeoutError(null)).toBe(false)
        expect(isWriteConcernTimeoutError('wtimeout')).toBe(false)
    })
})

describe('plain object helpers', () => {
    class SampleDto {
        id: string
        name: string
        optional?: boolean
    }

    it('정의된 값과 null을 복사하고 undefined는 생략하며 transform을 지원한다', () => {
        const target = { email: 'old' as null | string, id: 'old', name: 'old' }

        assignIfDefined(target, { name: 'new' }, 'name')
        assignIfDefined(target, { email: null as null | string | undefined }, 'email')
        assignIfDefined(target, { id: '123' }, 'id', (id) => `obj:${id}`)
        assignIfDefined(target, { name: undefined as string | undefined }, 'name')

        expect(target).toEqual({ email: null, id: 'obj:123', name: 'new' })
    })

    it('선택한 키만 DTO 인스턴스에 매핑한다', () => {
        const dto = mapDocToDto(
            { extra: true, id: 'id', name: 'name', optional: undefined },
            SampleDto,
            ['id', 'name', 'optional']
        )

        expect(dto).toBeInstanceOf(SampleDto)
        expect(dto).toEqual({ id: 'id', name: 'name', optional: undefined })
        expect(dto).not.toHaveProperty('extra')
    })
})
