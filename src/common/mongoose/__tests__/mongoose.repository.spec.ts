import { expect } from '@jest/globals'
import { maps, nullObjectId, OrderDirection, pickIds, pickItems } from 'common'
import { expectEqualUnsorted } from 'common'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
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
    let mongod: MongoMemoryReplSet
    let repository: SamplesRepository
    let teardown: () => void

    beforeAll(async () => {
        mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    }, 60000)

    afterAll(async () => {
        await mongod.stop()
    })

    beforeEach(async () => {
        const fixture = await createFixture(mongod.getUri())
        repository = fixture.repository
        teardown = fixture.close
    })

    afterEach(async () => {
        await teardown()
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
            samples = maps(docs, SampleDto)
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
            expect(samples.slice(skip, skip + take)).toEqual(maps(items, SampleDto))
            expect(paginated).toEqual({ total: samples.length, skip, take })
        })

        it('should sort in ascending order', async () => {
            const { items } = await repository.findWithPagination(() => {}, {
                orderby: { name: 'name', direction: OrderDirection.asc }
            })

            sortByName(samples)
            expect(maps(items, SampleDto)).toEqual(samples)
        })

        it('should sort in descending order', async () => {
            const { items } = await repository.findWithPagination(() => {}, {
                orderby: { name: 'name', direction: OrderDirection.desc }
            })

            sortByNameDescending(samples)
            expect(maps(items, SampleDto)).toEqual(samples)
        })

        it('should throw an exception if ‘take’ is absent or zero', async () => {
            const promise = repository.findWithPagination(() => {}, { take: 0 })

            await expect(promise).rejects.toThrow(MongooseException)
        })

        it('Should set conditions using the QueryHelper', async () => {
            const { items } = await repository.findWithPagination((helpers) => {
                helpers.setQuery({ name: /Sample-00/i })
            })

            const sorted = sortByName(maps(items, SampleDto))

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
            samples = maps(docs, SampleDto)
        })

        it('should return true if the IDs does exist', async () => {
            const exists = await repository.existsByIds(pickItems(samples, 'id'))
            expect(exists).toBeTruthy()
        })

        it('should return false if any ID does not exist', async () => {
            const exists = await repository.existsByIds([nullObjectId])
            expect(exists).toBeFalsy()
        })
    })

    describe('findById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(repository)
            sample = new SampleDto(doc)
        })

        it('should find a document by ID', async () => {
            const doc = await repository.findById(sample.id)

            expect(new SampleDto(doc!)).toEqual(sample)
        })

        it('should return null if the ID does not exist', async () => {
            const doc = await repository.findById(nullObjectId)

            expect(doc).toBeNull()
        })
    })

    describe('findByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = maps(docs, SampleDto)
        })

        it('should find documents by multiple IDs', async () => {
            const ids = pickIds(samples)
            const docs = await repository.findByIds(ids)

            expectEqualUnsorted(maps(docs, SampleDto), samples)
        })

        it('should ignore non-existent IDs', async () => {
            const docs = await repository.findByIds([nullObjectId])
            expect(docs).toHaveLength(0)
        })
    })

    describe('deleteByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = maps(docs, SampleDto)
        })

        it('should delete multiple documents successfully', async () => {
            const ids = pickIds(samples.slice(0, 10))

            const deletedCount = await repository.deleteByIds(ids)
            expect(deletedCount).toEqual(ids.length)

            const docs = await repository.findByIds(ids)

            expect(docs).toHaveLength(0)
        })

        it('should ignore non-existent IDs without errors', async () => {
            const deletedCount = await repository.deleteByIds([nullObjectId])

            expect(deletedCount).toEqual(0)
        })
    })
})
