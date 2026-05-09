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

it('generates a new ObjectId string', async () => {
    const objectIdValue = newObjectIdString()
    expect(Types.ObjectId.isValid(objectIdValue)).toBe(true)
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
    describe('모든 id가 유효할 때', () => {
        it('ObjectId로 변환한다', () => {
            const idStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
            const result = objectIds(idStrings)

            expect(result.map((id) => id.toString())).toEqual(idStrings)
            expect(result).toEqual([expect.any(Types.ObjectId), expect.any(Types.ObjectId)])
        })
    })

    describe('id가 비어 있을 때', () => {
        it('빈 배열을 반환한다', () => {
            const result = objectIds([])

            expect(result).toEqual([])
        })
    })

    describe('id 중 하나라도 유효하지 않을 때', () => {
        it('예외를 던진다', () => {
            const idStrings = ['507f1f77bcf86cd799439011', 'invalid-id']

            expect(() => objectIds(idStrings)).toThrow(
                'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
            )
        })
    })
})

describe('QueryBuilder', () => {
    type TestModel = { _id: Types.ObjectId; createdAt: Date; entityId: string; name: string }

    let builder: QueryBuilder<TestModel>

    beforeEach(() => {
        builder = new QueryBuilder<TestModel>()
    })

    describe('addEqual', () => {
        describe('값이 제공될 때', () => {
            it('조건을 추가한다', () => {
                builder.addEquals('name', 'test')
                expect(builder.build({})).toEqual({ name: 'test' })
            })
        })

        describe('값이 제공되지 않을 때', () => {
            it('조건을 추가하지 않는다', () => {
                builder.addEquals('name', undefined)
                builder.addEquals('name', null)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addId', () => {
        describe('id가 제공될 때', () => {
            it('ObjectId 조건을 추가한다', () => {
                const id = new Types.ObjectId().toString()
                builder.addId('_id', id)
                expect(builder.build({})).toEqual({ _id: objectId(id) })
            })
        })

        describe('id가 제공되지 않을 때', () => {
            it('조건을 추가하지 않는다', () => {
                builder.addId('_id', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addIn', () => {
        describe('ids가 제공될 때', () => {
            const ids = ['123', '456']

            it('$in 조건을 추가한다', () => {
                builder.addIn('entityId', ids)
                expect(builder.build({})).toEqual({ entityId: { $in: ids } })
            })
        })

        describe('ids에 중복이 있을 때', () => {
            const ids = ['123', '123']

            beforeEach(() => {
                jest.spyOn(Logger, 'warn').mockImplementation(() => {})
            })

            it('중복을 제거한다', () => {
                builder.addIn('entityId', ids)
                expect(builder.build({})).toEqual({ entityId: { $in: ['123'] } })
            })
        })

        describe('ids가 비어 있거나 제공되지 않을 때', () => {
            it('조건을 추가하지 않는다', () => {
                builder.addIn('entityId', [])
                builder.addIn('entityId', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('addRegex', () => {
        describe('값이 제공될 때', () => {
            it('정규식 조건을 추가한다', () => {
                builder.addRegex('name', 'test')
                expect(builder.build({})).toEqual({ name: new RegExp('test', 'i') })
            })
        })

        describe('값이 제공되지 않을 때', () => {
            it('조건을 추가하지 않는다', () => {
                builder.addRegex('name', undefined)
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })

        // cycle-10: prefix 옵션으로 ^ 앵커링
        describe('with { prefix: true }', () => {
            it('anchors the regex at start', () => {
                builder.addRegex('name', 'hello', { prefix: true })
                expect(builder.build({})).toEqual({ name: new RegExp('^hello', 'i') })
            })

            it('escapes regex special chars', () => {
                builder.addRegex('name', 'a.b*', { prefix: true })
                expect(builder.build({})).toEqual({ name: new RegExp('^a\\.b\\*', 'i') })
            })
        })

        // cycle-10: caseSensitive 옵션으로 i 플래그 제거
        describe('with { caseSensitive: true }', () => {
            it('drops the i flag', () => {
                builder.addRegex('name', 'test', { caseSensitive: true })
                expect(builder.build({})).toEqual({ name: new RegExp('test') })
            })
        })

        // cycle-12: prefix + caseSensitive 조합 (theater/movie/user 검색 모드)
        describe('with both prefix and caseSensitive', () => {
            it('anchors and drops the i flag', () => {
                builder.addRegex('name', 'test', { prefix: true, caseSensitive: true })
                expect(builder.build({})).toEqual({ name: new RegExp('^test') })
            })
        })
    })

    describe('addRange', () => {
        describe('start와 end가 제공될 때', () => {
            it('$gte와 $lte 조건을 추가한다', () => {
                const range = { end: new Date('2023-12-31'), start: new Date('2023-01-01') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({
                    createdAt: { $gte: range.start, $lte: range.end }
                })
            })
        })

        describe('start만 제공될 때', () => {
            it('$gte만 추가한다', () => {
                const range = { start: new Date('2023-01-01') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({ createdAt: { $gte: range.start } })
            })
        })

        describe('end만 제공될 때', () => {
            it('$lte만 추가한다', () => {
                const range = { end: new Date('2023-12-31') }
                builder.addRange('createdAt', range)
                expect(builder.build({})).toEqual({ createdAt: { $lte: range.end } })
            })
        })

        describe('range가 비어 있거나 제공되지 않을 때', () => {
            it('조건을 추가하지 않는다', () => {
                builder.addRange('createdAt', undefined)
                builder.addRange('createdAt', {})
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
        })
    })

    describe('build', () => {
        describe('조건이 존재할 때', () => {
            it('쿼리 객체를 반환한다', () => {
                builder.addEquals('name', 'test')
                expect(builder.build({})).toEqual({ name: 'test' })
            })
        })

        describe('조건이 없을 때', () => {
            it('BadRequestException을 던진다', () => {
                expect(() => builder.build({})).toThrow(BadRequestException)
            })
        })

        describe('allowEmpty가 true일 때', () => {
            it('빈 쿼리를 반환한다', () => {
                expect(builder.build({ allowEmpty: true })).toEqual({})
            })
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

    it('lean 객체를 DTO로 매핑한다', () => {
        const doc = new SampleModel({ name: 'name', optional: undefined }).toJSON()

        const dto = mapDocToDto(doc, SampleDto, ['id', 'name', 'optional'])

        expect(dto).toEqual({ id: expect.any(String), name: 'name', optional: undefined })
    })
})

describe('isDuplicateKeyError', () => {
    it('MongoDB E11000 에러 객체일 때 true', () => {
        expect(isDuplicateKeyError({ code: 11000, message: 'duplicate' })).toBe(true)
    })

    it('code 가 11000 이 아닐 때 false', () => {
        expect(isDuplicateKeyError({ code: 121 })).toBe(false)
    })

    it('code 속성이 없을 때 false', () => {
        expect(isDuplicateKeyError({ message: 'boom' })).toBe(false)
    })

    it('null 또는 원시 타입일 때 false', () => {
        expect(isDuplicateKeyError(null)).toBe(false)
        expect(isDuplicateKeyError(undefined)).toBe(false)
        expect(isDuplicateKeyError('error')).toBe(false)
        expect(isDuplicateKeyError(11000)).toBe(false)
    })
})

describe('assignIfDefined', () => {
    describe('source[key]가 정의되어 있을 때', () => {
        it('target[key]에 할당한다', () => {
            const target = { name: 'old' }
            const source = { name: 'new' as string | undefined }

            assignIfDefined(target, source, 'name')

            expect(target.name).toBe('new')
        })
    })

    describe('source[key]가 제공되지 않을 때', () => {
        it('target을 변경하지 않는다', () => {
            const target = { name: 'old' }
            const source = { name: undefined as string | undefined }

            assignIfDefined(target, source, 'name')

            expect(target.name).toBe('old')
        })
    })

    describe('transform이 제공될 때', () => {
        it('변환된 값을 할당한다', () => {
            const target = { id: 'old' }
            const source = { id: '123' as string | undefined }

            assignIfDefined(target, source, 'id', (v) => `obj:${v}`)

            expect(target.id).toBe('obj:123')
        })
    })

    describe('source[key]가 null일 때', () => {
        it('null을 정의된 값으로 취급한다', () => {
            const target = { email: 'old' as null | string }
            const source = { email: null as null | string | undefined }

            assignIfDefined(target, source, 'email')

            expect(target.email).toBeNull()
        })
    })
})
