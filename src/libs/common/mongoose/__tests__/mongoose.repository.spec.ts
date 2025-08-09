import { MongooseErrors, OrderDirection, pickIds, pickItems } from 'common'
import { expectEqualUnsorted, nullObjectId } from 'testlib'
import {
    createSample,
    createSamples,
    Fixture,
    SampleDto,
    sortByName,
    sortByNameDescending,
    toDto,
    toDtos
} from './mongoose.repository.fixture'

describe('MongooseRepository', () => {
    let fix: Fixture
    let maxTake = 0

    beforeEach(async () => {
        const { createFixture, maxTakeValue } = await import('./mongoose.repository.fixture')
        fix = await createFixture()
        maxTake = maxTakeValue
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('save', () => {
        // 새 문서를 성공적으로 생성해야 한다
        it('Should successfully create a new document', async () => {
            const newDoc = fix.repository.newDocument()
            newDoc.name = 'document name'
            await newDoc.save()

            const foundDoc = await fix.repository.findById(newDoc.id)
            expect(toDto(foundDoc!)).toEqual(toDto(newDoc))
        })

        // 필수 필드가 누락된 경우 예외를 던져야 한다
        it('Should throw an exception if required fields are missing', async () => {
            const doc = fix.repository.newDocument()
            const promise = doc.save()
            await expect(promise).rejects.toThrow()
        })

        // 문서를 성공적으로 업데이트해야 한다
        it('Should successfully update a document', async () => {
            const newDoc = fix.repository.newDocument()
            newDoc.name = 'name1'
            await newDoc.save()

            const updateDoc = (await fix.repository.findById(newDoc.id))!
            updateDoc.name = 'name2'
            await updateDoc!.save()

            const foundDoc = await fix.repository.findById(newDoc.id)

            expect(foundDoc?.name).toEqual('name2')
        })
    })

    describe('saveMany', () => {
        // 여러 문서를 성공적으로 생성해야 한다
        it('Should successfully create multiple documents', async () => {
            const docs = [
                { name: 'document-1' },
                { name: 'document-2' },
                { name: 'document-2' }
            ].map((data) => {
                const doc = fix.repository.newDocument()
                doc.name = data.name
                return doc
            })

            const res = await fix.repository.saveMany(docs)

            expect(res).toBe(true)
        })

        // 필수 필드가 누락된 경우 예외를 던져야 한다
        it('Should throw an exception if required fields are missing in any of the documents', async () => {
            const docs = [fix.repository.newDocument(), fix.repository.newDocument()]

            const promise = fix.repository.saveMany(docs)

            await expect(promise).rejects.toThrow()
        })
    })

    describe('findWithPagination', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const { createSamples } = await import('./mongoose.repository.fixture')

            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        // 페이지네이션을 올바르게 설정해야 한다
        it('Should correctly handle pagination', async () => {
            const skip = 10
            const take = 5
            const { items, ...pagination } = await fix.repository.findWithPagination({
                pagination: { skip, take, orderby: { name: 'name', direction: OrderDirection.Asc } }
            })

            sortByName(samples)
            expect(samples.slice(skip, skip + take)).toEqual(toDtos(items))
            expect(pagination).toEqual({ total: samples.length, skip, take })
        })

        // 오름차순으로 정렬해야 한다
        it('Should sort in ascending order', async () => {
            const { items } = await fix.repository.findWithPagination({
                pagination: {
                    take: samples.length,
                    orderby: { name: 'name', direction: OrderDirection.Asc }
                }
            })

            sortByName(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        // 내림차순으로 정렬해야 한다
        it('Should sort in descending order', async () => {
            const { items } = await fix.repository.findWithPagination({
                pagination: {
                    take: samples.length,
                    orderby: { name: 'name', direction: OrderDirection.Desc }
                }
            })

            sortByNameDescending(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        // take 값이 양수가 아니면 예외를 던져야 한다
        it('Should throw an exception if the take value is not positive', async () => {
            const promise = fix.repository.findWithPagination({ pagination: { take: -1 } })

            await expect(promise).rejects.toThrow(fix.BadRequestException)
        })

        // 'take' 값이 지정된 제한을 초과하면 BadRequest를 반환해야 한다
        it("should return BadRequest when the 'take' value exceeds the specified limit", async () => {
            const take = maxTake + 1

            const promise = fix.repository.findWithPagination({ pagination: { take } })

            await expect(promise).rejects.toThrow(fix.BadRequestException)
        })

        // 'take' 값이 지정되지 않은 경우 기본값이 사용되어야 한다
        it("should use the default value if the 'take' value is not specified", async () => {
            const { take } = await fix.repository.findWithPagination({
                pagination: { orderby: { name: 'name', direction: OrderDirection.Desc } }
            })

            expect(take).toEqual(maxTake)
        })

        // QueryHelper를 사용해 조건을 설정해야 한다
        it('Should apply conditions using QueryHelper', async () => {
            const { items } = await fix.repository.findWithPagination({
                configureQuery: (queryHelper) => {
                    queryHelper.setQuery({ name: /Sample-00/i })
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
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        // ID들이 존재하면 true를 반환해야 한다
        it('Should return true if all IDs exist', async () => {
            const exists = await fix.repository.existByIds(pickIds(samples))
            expect(exists).toBe(true)
        })

        // 존재하지 않는 ID가 있으면 false를 반환해야 한다
        it('Should return false if any of the IDs do not exist', async () => {
            const exists = await fix.repository.existByIds([nullObjectId])
            expect(exists).toBe(false)
        })
    })

    describe('findById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fix.repository)
            sample = toDto(doc)
        })

        // ID로 문서를 찾아야 한다
        it('Should find a document by ID', async () => {
            const doc = await fix.repository.findById(sample.id)

            expect(toDto(doc!)).toEqual(sample)
        })

        // 존재하지 않는 ID의 경우 null을 반환해야 한다
        it('Should return null if the document does not exist', async () => {
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

        // 여러 ID로 문서를 찾아야 한다
        it('Should find multiple documents by their IDs', async () => {
            const ids = pickIds(samples)
            const docs = await fix.repository.findByIds(ids)

            expectEqualUnsorted(toDtos(docs), samples)
        })

        // 존재하지 않는 ID는 무시해야 한다
        it('Should ignore any non-existent IDs', async () => {
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

        // ID로 문서를 찾아야 한다
        it('Should get a document by ID', async () => {
            const doc = await fix.repository.getById(sample.id)

            expect(toDto(doc)).toEqual(sample)
        })

        // 존재하지 않는 ID의 경우 예외를 던져야 한다
        it('Should throw an exception if the document does not exist', async () => {
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

        // 여러 ID로 문서를 찾아야 한다
        it('Should get multiple documents by their IDs', async () => {
            const ids = pickIds(samples)
            const docs = await fix.repository.getByIds(ids)

            expectEqualUnsorted(toDtos(docs), samples)
        })

        // 하나라도 존재하지 않는 ID가 있으면 예외를 던져야 한다
        it('Should throw an exception if any ID does not exist', async () => {
            const promise = fix.repository.getByIds([nullObjectId])

            await expect(promise).rejects.toThrow(fix.NotFoundException)
        })
    })

    describe('deleteById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fix.repository)
            sample = toDto(doc)
        })

        // ID로 문서를 찾아 삭제해야 한다
        it('Should delete a document by ID', async () => {
            await fix.repository.deleteById(sample.id)
            const doc = await fix.repository.findById(sample.id)

            expect(doc).toBeNull()
        })

        // 존재하지 않는 ID의 경우 예외를 던져야 한다
        it('Should throw an exception if the document does not exist', async () => {
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

        // 여러 문서를 한 번에 삭제해야 한다
        it('Should delete multiple documents at once', async () => {
            const samplesToDelete = samples.slice(5, 10)
            const ids = pickIds(samplesToDelete)

            const deletedDocs = await fix.repository.deleteByIds(ids)
            expect(toDtos(deletedDocs)).toEqual(samplesToDelete)

            const docs = await fix.repository.findByIds(ids)
            expect(docs).toHaveLength(0)
        })

        // 존재하지 않는 IDs의 경우 예외를 던져야 한다
        it('Should throw an exception if any of the IDs do not exist', async () => {
            const promise = fix.repository.deleteByIds([nullObjectId])

            const error = await promise.catch((e) => e)

            expect(error).toBeInstanceOf(fix.NotFoundException)
            expect(error.response).toEqual({
                ...MongooseErrors.MultipleDocumentsNotFound,
                notFoundIds: [nullObjectId]
            })
        })
    })
})
