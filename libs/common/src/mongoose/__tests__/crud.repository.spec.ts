import { expectEqualUnsorted, nullObjectId } from '@mannercode/testing'
import { Types } from 'mongoose'
import { OrderDirection } from '../../pagination'
import { pickIds } from '../../utils'
import { leanToPublic } from '../crud.repository'
import {
    createSample,
    createSamples,
    maxSizeValue,
    sortByName,
    sortByNameDescending,
    toDto,
    toDtos,
    type CrudRepositoryFixture,
    type SampleDto
} from './crud.repository.fixture'

describe('CrudRepository', () => {
    let fix: CrudRepositoryFixture

    beforeEach(async () => {
        const { createCrudRepositoryFixture } = await import('./crud.repository.fixture')
        fix = await createCrudRepositoryFixture()
    })
    afterEach(() => fix.teardown())

    describe('save', () => {
        it('문서를 생성한다', async () => {
            const newDoc = fix.repository.newDocument()
            newDoc.name = 'document name'
            await newDoc.save()

            const foundDoc = await fix.repository.findById(newDoc.id)
            expect(toDto(foundDoc)).toEqual(toDto(newDoc))
        })

        it('필수 필드가 없으면 예외를 던진다', async () => {
            const doc = fix.repository.newDocument()
            const promise = doc.save()
            await expect(promise).rejects.toThrow()
        })
    })

    describe('saveMany', () => {
        it('모든 문서를 생성한다', async () => {
            const docs = [
                { name: 'document-1' },
                { name: 'document-2' },
                { name: 'document-2' }
            ].map((data) => {
                const doc = fix.repository.newDocument()
                doc.name = data.name
                return doc
            })

            await fix.repository.saveMany(docs)

            const fetched = await fix.repository.findByIds(docs.map((d) => d._id.toString()))
            expect(fetched).toHaveLength(docs.length)
        })

        it('필수 필드가 없으면 예외를 던진다', async () => {
            const docs = [fix.repository.newDocument(), fix.repository.newDocument()]

            const promise = fix.repository.saveMany(docs)

            await expect(promise).rejects.toThrow()
        })

        it.todo(
            'inserted + matched + deleted 의 합이 docs.length 와 다르면 Require.equals 가 throw 한다'
        )
    })

    describe('findWithPagination', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        it('올바른 페이지네이션으로 항목을 반환한다', async () => {
            const page = 3
            const size = 5
            const { items, ...pagination } = await fix.repository.findWithPagination({
                pagination: { size, orderby: { direction: OrderDirection.Asc, name: 'name' }, page }
            })

            sortByName(samples)
            const skip = (page - 1) * size
            expect(samples.slice(skip, skip + size)).toEqual(toDtos(items))
            expect(pagination).toEqual({ size, page, total: samples.length })
        })

        it('오름차순으로 정렬한다', async () => {
            const { items } = await fix.repository.findWithPagination({
                pagination: {
                    orderby: { direction: OrderDirection.Asc, name: 'name' },
                    size: samples.length
                }
            })

            sortByName(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        it('내림차순으로 정렬한다', async () => {
            const { items } = await fix.repository.findWithPagination({
                pagination: {
                    orderby: { direction: OrderDirection.Desc, name: 'name' },
                    size: samples.length
                }
            })

            sortByNameDescending(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        it('size 값이 0 이하이면 예외를 던진다', async () => {
            const promise = fix.repository.findWithPagination({ pagination: { size: -1 } })

            await expect(promise).rejects.toThrow(fix.BadRequestException)
        })

        it('maxLimit을 초과한 size에 대해 BadRequestException을 던진다', async () => {
            const size = maxSizeValue + 1

            const promise = fix.repository.findWithPagination({ pagination: { size } })

            await expect(promise).rejects.toThrow(fix.BadRequestException)
        })

        describe('size가 제공되지 않을 때', () => {
            it('기본 size 값을 사용한다', async () => {
                const { size } = await fix.repository.findWithPagination({
                    pagination: { orderby: { direction: OrderDirection.Desc, name: 'name' } }
                })

                expect(size).toEqual(maxSizeValue)
            })
        })

        it('설정된 조건을 적용한다', async () => {
            const { items } = await fix.repository.findWithPagination({
                configureQuery: async (queryHelper) => {
                    queryHelper.setQuery({ name: /Sample-00/i })
                },
                pagination: { size: 10 }
            })

            const names = sortByName(toDtos(items)).map(({ name }) => name)

            expect(names).toEqual([
                'Sample-000',
                'Sample-001',
                'Sample-002',
                'Sample-003',
                'Sample-004',
                'Sample-005',
                'Sample-006',
                'Sample-007',
                'Sample-008',
                'Sample-009'
            ])
        })

        it.todo(
            '빈 filter 에서 estimatedDocumentCount 의 트레이드오프대로 soft-deleted 행이 total 에는 포함되고 items 에서는 제외된다'
        )
        it.todo(
            '빈 filter 일 때 model.estimatedDocumentCount() 가 호출되고 model.countDocuments() 는 호출되지 않는다 (perf 최적화 분기 lock-down)'
        )
        it.todo('비어있지 않은 filter 일 때 model.countDocuments() 가 filter 와 함께 호출된다')
    })

    describe('allExist', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        it('모든 id가 존재할 때 true를 반환한다', async () => {
            const exists = await fix.repository.allExist(pickIds(samples))
            expect(exists).toBe(true)
        })

        it('id에 중복이 포함될 때 true를 반환한다', async () => {
            const [first] = samples
            const exists = await fix.repository.allExist([first.id, first.id])

            expect(exists).toBe(true)
        })

        it('id 중 하나라도 없을 때 false를 반환한다', async () => {
            const exists = await fix.repository.allExist([nullObjectId])
            expect(exists).toBe(false)
        })

        it('id 배열이 비어 있을 때 true를 반환한다', async () => {
            const exists = await fix.repository.allExist([])
            expect(exists).toBe(true)
        })
    })

    describe('findById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fix.repository)
            sample = toDto(doc)
        })

        it('존재하는 id의 문서를 반환한다', async () => {
            const doc = await fix.repository.findById(sample.id)

            expect(toDto(doc)).toEqual(sample)
        })

        it('없는 id에 대해 null을 반환한다', async () => {
            const doc = await fix.repository.findById(nullObjectId)

            expect(doc).toBeNull()
        })
    })

    describe('findByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        it('존재하는 id의 문서를 반환한다', async () => {
            const ids = pickIds(samples)
            const docs = await fix.repository.findByIds(ids)

            expectEqualUnsorted(toDtos(docs), samples)
        })

        it('없는 id는 무시한다', async () => {
            const docs = await fix.repository.findByIds([nullObjectId])
            expect(docs).toHaveLength(0)
        })
    })

    describe('getById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fix.repository)
            sample = toDto(doc)
        })

        it('존재하는 id의 문서를 반환한다', async () => {
            const doc = await fix.repository.getById(sample.id)
            expect(toDto(doc)).toEqual(sample)
        })

        it('없는 id에 대해 NotFoundException을 던진다', async () => {
            const promise = fix.repository.getById(nullObjectId)

            await expect(promise).rejects.toThrow(fix.NotFoundException)
        })
    })

    describe('getByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        describe('모든 id가 존재할 때', () => {
            it('문서를 반환한다', async () => {
                const ids = pickIds(samples)
                const docs = await fix.repository.getByIds(ids)

                expectEqualUnsorted(toDtos(docs), samples)
            })
        })

        describe('id 중 하나라도 없을 때', () => {
            it('NotFoundException을 던진다', async () => {
                const promise = fix.repository.getByIds([nullObjectId])

                await expect(promise).rejects.toThrow(fix.NotFoundException)
            })
        })

        describe('중복된 id 가 입력으로 들어왔을 때', () => {
            it.todo('Assume.equalLength 가 throw 한다')
        })
    })

    describe('deleteById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fix.repository)
            sample = toDto(doc)
        })

        it('존재하는 id의 문서를 삭제한다', async () => {
            await fix.repository.deleteById(sample.id)
            const doc = await fix.repository.findById(sample.id)

            expect(doc).toBeNull()
        })

        it('없는 id에 대해 NotFoundException을 던진다', async () => {
            const promise = fix.repository.deleteById(nullObjectId)

            await expect(promise).rejects.toThrow(fix.NotFoundException)
        })
    })

    describe('deleteByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        describe('모든 id가 존재할 때', () => {
            it('문서를 삭제한다', async () => {
                const ids = pickIds(samples.slice(5, 10))
                const result = await fix.repository.deleteByIds(ids)
                expect(result).toEqual({ deletedCount: ids.length })

                const docs = await fix.repository.findByIds(ids)
                expect(docs).toHaveLength(0)
            })
        })

        describe('id 중 하나라도 없을 때', () => {
            it('없는 id는 무시한다', async () => {
                const promise = fix.repository.deleteByIds([nullObjectId])
                await expect(promise).resolves.toEqual({ deletedCount: 0 })
            })
        })
    })
})

describe('leanToPublic', () => {
    it('_id 가 있을 때 id 필드를 추가한다', () => {
        const objectId = new Types.ObjectId()
        const result = leanToPublic<{ _id: Types.ObjectId; id?: string }>({ _id: objectId })
        expect(result.id).toBe(String(objectId))
    })

    it('_id 가 nullish 이면 id 를 추가하지 않는다', () => {
        const result = leanToPublic<{ _id?: unknown; id?: string }>({})
        expect(result.id).toBeUndefined()
    })

    it.todo('입력 객체를 in-place 변경하며 같은 참조를 돌려준다')
    it.todo(
        'lean 호출이 virtuals 옵션 없이 실행된다 (mongoose-lean-virtuals 비활성 — perf 가정 lock-down)'
    )
    it.todo('lean 결과에 id 필드가 자동으로 생기지 않는다 (leanToPublic 의 존재 이유 lock-down)')
    it.todo('lean 결과의 _id 는 ObjectId 인스턴스로 유지되어 toString() 비교가 가능하다')
})
