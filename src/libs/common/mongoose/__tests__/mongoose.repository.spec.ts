import { expect } from '@jest/globals'
import { objectId, objectIds, OrderDirection, pickIds, pickItems, toDtos } from 'common'
import { expectEqualUnsorted, getMongoTestConnection, nullObjectId } from 'testlib'
import { MongooseException } from '../exceptions'
import {
    createFixture,
    createSample,
    createSamples,
    SampleDto,
    SamplesRepository,
    sortByName,
    sortByNameDescending
} from './mongoose.repository.fixture'

describe('MongoRepository', () => {
    let repository: SamplesRepository
    let close: () => void

    beforeEach(async () => {
        const uri = getMongoTestConnection()

        const fixture = await createFixture(uri)
        repository = fixture.repository
        close = fixture.close
    })

    afterEach(async () => {
        await close()
    })

    describe('save', () => {
        it('should successfully create a document', async () => {
            const newDoc = repository.newDocument()
            newDoc.name = 'document name'
            await newDoc.save()

            const findDoc = await repository.findById(newDoc.id)
            expect(new SampleDto(findDoc!)).toEqual(new SampleDto(newDoc))
        })

        it('should throw an exception if required fields are missing', async () => {
            const doc = repository.newDocument()
            const promise = doc.save()
            await expect(promise).rejects.toThrowError()
        })

        it('should successfully update a document', async () => {
            const newDoc = repository.newDocument()
            newDoc.name = 'name1'
            await newDoc.save()

            const updateDoc = await repository.findById(newDoc.id)
            updateDoc!.name = 'name2'
            await updateDoc!.save()

            const findDoc = await repository.findById(newDoc.id)

            expect(findDoc?.name).toEqual('name2')
        })
    })

    describe('saveAll', () => {
        it('should successfully create multiple documents', async () => {
            const docs = [
                { name: 'document-1' },
                { name: 'document-2' },
                { name: 'document-2' }
            ].map((data) => {
                const doc = repository.newDocument()
                doc.name = data.name
                return doc
            })

            const res = await repository.saveAll(docs)

            expect(res).toBeTruthy()
        })

        it('should throw an exception if required fields are missing', async () => {
            const docs = [repository.newDocument(), repository.newDocument()]

            const promise = repository.saveAll(docs)

            await expect(promise).rejects.toThrowError()
        })
    })

    describe('findWithPagination', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs, SampleDto)
        })

        it('should set the pagination correctly', async () => {
            const skip = 10
            const take = 5
            const { items, ...paginated } = await repository.findWithPagination(() => {}, {
                skip,
                take,
                orderby: { name: 'name', direction: OrderDirection.asc }
            })

            sortByName(samples)
            expect(samples.slice(skip, skip + take)).toEqual(toDtos(items, SampleDto))
            expect(paginated).toEqual({ total: samples.length, skip, take })
        })

        it('should sort in ascending order', async () => {
            const { items } = await repository.findWithPagination(() => {}, {
                orderby: { name: 'name', direction: OrderDirection.asc }
            })

            sortByName(samples)
            expect(toDtos(items, SampleDto)).toEqual(samples)
        })

        it('should sort in descending order', async () => {
            const { items } = await repository.findWithPagination(() => {}, {
                orderby: { name: 'name', direction: OrderDirection.desc }
            })

            sortByNameDescending(samples)
            expect(toDtos(items, SampleDto)).toEqual(samples)
        })

        it('should throw an exception if ‘take’ is absent or zero', async () => {
            const promise = repository.findWithPagination(() => {}, { take: 0 })

            await expect(promise).rejects.toThrow(MongooseException)
        })

        it('Should set conditions using the QueryHelper', async () => {
            const { items } = await repository.findWithPagination((helpers) => {
                helpers.setQuery({ name: /Sample-00/i })
            })

            const sorted = sortByName(toDtos(items, SampleDto))

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

    describe('existsByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs, SampleDto)
        })

        it('should return true if the IDs does exist', async () => {
            const exists = await repository.existsByIds(objectIds(pickItems(samples, 'id')))
            expect(exists).toBeTruthy()
        })

        it('should return false if any ID does not exist', async () => {
            const exists = await repository.existsByIds(objectIds([nullObjectId]))
            expect(exists).toBeFalsy()
        })
    })

    describe('findById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(repository)
            sample = new SampleDto(doc.toJSON())
        })

        it('should find a document by ID', async () => {
            const doc = await repository.findById(objectId(sample.id))

            expect(new SampleDto(doc!.toJSON())).toEqual(sample)
        })

        it('should return null if the ID does not exist', async () => {
            const doc = await repository.findById(objectId(nullObjectId))

            expect(doc).toBeNull()
        })
    })

    describe('findByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs, SampleDto)
        })

        it('should find documents by multiple IDs', async () => {
            const ids = pickIds(samples)
            const docs = await repository.findByIds(objectIds(ids))

            expectEqualUnsorted(toDtos(docs, SampleDto), samples)
        })

        it('should ignore non-existent IDs', async () => {
            const docs = await repository.findByIds(objectIds([nullObjectId]))
            expect(docs).toHaveLength(0)
        })
    })

    describe('deleteByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs, SampleDto)
        })

        it('should delete multiple documents successfully', async () => {
            const ids = pickIds(samples.slice(0, 10))

            const deletedCount = await repository.deleteByIds(objectIds(ids))
            expect(deletedCount).toEqual(ids.length)

            const docs = await repository.findByIds(objectIds(ids))

            expect(docs).toHaveLength(0)
        })

        it('should ignore non-existent IDs without errors', async () => {
            const deletedCount = await repository.deleteByIds(objectIds([nullObjectId]))

            expect(deletedCount).toEqual(0)
        })
    })
})
