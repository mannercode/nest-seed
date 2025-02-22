import { expect } from '@jest/globals'
import { OrderDirection, pickIds, pickItems } from 'common'
import { CloseFixture, expectEqualUnsorted, nullObjectId } from 'testlib'
import {
    createSample,
    createSamples,
    SampleDto,
    SamplesRepository,
    sortByName,
    sortByNameDescending,
    toDto,
    toDtos
} from './mongoose.repository.fixture'

describe('MongooseRepository', () => {
    let BadRequestException: any
    let NotFoundException: any

    let closeFixture: CloseFixture
    let repository: SamplesRepository

    beforeEach(async () => {
        const { createFixture } = await import('./mongoose.repository.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        repository = fixture.repository
        BadRequestException = fixture.BadRequestException
        NotFoundException = fixture.NotFoundException
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    describe('save', () => {
        it('문서를 성공적으로 생성해야 한다', async () => {
            const newDoc = repository.newDocument()
            newDoc.name = 'document name'
            await newDoc.save()

            const findDoc = await repository.findById(newDoc.id)
            expect(toDto(findDoc!)).toEqual(toDto(newDoc))
        })

        it('필수 필드가 누락된 경우 예외를 발생시켜야 한다', async () => {
            const doc = repository.newDocument()
            const promise = doc.save()
            await expect(promise).rejects.toThrow()
        })

        it('문서를 성공적으로 업데이트해야 한다', async () => {
            const newDoc = repository.newDocument()
            newDoc.name = 'name1'
            await newDoc.save()

            const updateDoc = (await repository.findById(newDoc.id))!
            updateDoc.name = 'name2'
            await updateDoc!.save()

            const findDoc = await repository.findById(newDoc.id)

            expect(findDoc?.name).toEqual('name2')
        })
    })

    describe('saveMany', () => {
        it('여러 문서를 성공적으로 생성해야 한다', async () => {
            const docs = [
                { name: 'document-1' },
                { name: 'document-2' },
                { name: 'document-2' }
            ].map((data) => {
                const doc = repository.newDocument()
                doc.name = data.name
                return doc
            })

            const res = await repository.saveMany(docs)

            expect(res).toBeTruthy()
        })

        it('필수 필드가 누락된 경우 예외를 발생시켜야 한다', async () => {
            const docs = [repository.newDocument(), repository.newDocument()]

            const promise = repository.saveMany(docs)

            await expect(promise).rejects.toThrow()
        })
    })

    describe('findWithPagination', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const { createSamples } = await import('./mongoose.repository.fixture')

            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('페이지네이션을 올바르게 설정해야 한다', async () => {
            const skip = 10
            const take = 5
            const { items, ...paginated } = await repository.findWithPagination({
                pagination: { skip, take, orderby: { name: 'name', direction: OrderDirection.asc } }
            })

            sortByName(samples)
            expect(samples.slice(skip, skip + take)).toEqual(toDtos(items))
            expect(paginated).toEqual({ total: samples.length, skip, take })
        })

        it('오름차순으로 정렬해야 한다', async () => {
            const { items } = await repository.findWithPagination({
                pagination: {
                    take: samples.length,
                    orderby: { name: 'name', direction: OrderDirection.asc }
                }
            })

            sortByName(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        it('내림차순으로 정렬해야 한다', async () => {
            const { items } = await repository.findWithPagination({
                pagination: {
                    take: samples.length,
                    orderby: { name: 'name', direction: OrderDirection.desc }
                }
            })

            sortByNameDescending(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        it('take 값이 양수가 아니면 예외를 발생시켜야 한다', async () => {
            const promise = repository.findWithPagination({ pagination: { take: -1 } })

            await expect(promise).rejects.toThrow(BadRequestException)
        })

        it('take 값이 지정되지 않은 경우 예외를 발생시켜야 한다', async () => {
            const promise = repository.findWithPagination({ pagination: {} })

            await expect(promise).rejects.toThrow(BadRequestException)
        })

        it('QueryHelper를 사용해 조건을 설정해야 한다', async () => {
            const { items } = await repository.findWithPagination({
                callback: (helpers) => {
                    helpers.setQuery({ name: /Sample-00/i })
                },
                pagination: { take: 10 }
            })

            const sorted = sortByName(toDtos(items))

            expect(pickItems(sorted, 'name')).toEqual([
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
    })

    describe('existByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('ID들이 존재하면 true를 반환해야 한다', async () => {
            const exists = await repository.existByIds(pickIds(samples))
            expect(exists).toBeTruthy()
        })

        it('존재하지 않는 ID가 있으면 false를 반환해야 한다', async () => {
            const exists = await repository.existByIds([nullObjectId])
            expect(exists).toBeFalsy()
        })
    })

    describe('findById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(repository)
            sample = toDto(doc)
        })

        it('ID로 문서를 찾아야 한다', async () => {
            const doc = await repository.findById(sample.id)

            expect(toDto(doc!)).toEqual(sample)
        })

        it('존재하지 않는 ID의 경우 null을 반환해야 한다', async () => {
            const doc = await repository.findById(nullObjectId)

            expect(doc).toBeNull()
        })
    })

    describe('findByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('여러 ID로 문서를 찾아야 한다', async () => {
            const ids = pickIds(samples)
            const docs = await repository.findByIds(ids)

            expectEqualUnsorted(toDtos(docs), samples)
        })

        it('존재하지 않는 ID는 무시해야 한다', async () => {
            const docs = await repository.findByIds([nullObjectId])
            expect(docs).toHaveLength(0)
        })
    })

    describe('getById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(repository)
            sample = toDto(doc)
        })

        it('ID로 문서를 찾아야 한다', async () => {
            const doc = await repository.getById(sample.id)

            expect(toDto(doc)).toEqual(sample)
        })

        it('존재하지 않는 ID의 경우 예외를 발생시켜야 한다', async () => {
            const promise = repository.getById(nullObjectId)

            await expect(promise).rejects.toThrow(NotFoundException)
        })
    })

    describe('getByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('여러 ID로 문서를 찾아야 한다', async () => {
            const ids = pickIds(samples)
            const docs = await repository.getByIds(ids)

            expectEqualUnsorted(toDtos(docs), samples)
        })

        it('하나라도 존재하지 않는 ID가 있으면 예외를 발생시켜야 한다', async () => {
            const promise = repository.getByIds([nullObjectId])

            await expect(promise).rejects.toThrow(NotFoundException)
        })
    })

    describe('deleteById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(repository)
            sample = toDto(doc)
        })

        it('ID로 문서를 찾아 삭제해야 한다', async () => {
            await repository.deleteById(sample.id)
            const doc = await repository.findById(sample.id)

            expect(doc).toBeNull()
        })

        it('존재하지 않는 ID의 경우 예외를 발생시켜야 한다', async () => {
            const promise = repository.deleteById(nullObjectId)

            await expect(promise).rejects.toThrow(NotFoundException)
        })
    })

    describe('deleteByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('여러 문서를 한 번에 삭제해야 한다', async () => {
            const ids = pickIds(samples.slice(0, 10))

            const deletedCount = await repository.deleteByIds(ids)
            expect(deletedCount).toEqual(ids.length)

            const docs = await repository.findByIds(ids)

            expect(docs).toHaveLength(0)
        })

        it('존재하지 않는 ID는 무시해야 한다', async () => {
            const deletedCount = await repository.deleteByIds([nullObjectId])

            expect(deletedCount).toEqual(0)
        })
    })
})
