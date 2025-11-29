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
    let fixture: Fixture
    let maxTake = 0

    beforeEach(async () => {
        const { createFixture, maxTakeValue } = await import('./mongoose.repository.fixture')
        fixture = await createFixture()
        maxTake = maxTakeValue
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('save', () => {
        describe('when creating a new document', () => {
            it('creates the document', async () => {
                const newDoc = fixture.repository.newDocument()
                newDoc.name = 'document name'
                await newDoc.save()

                const foundDoc = await fixture.repository.findById(newDoc.id)
                expect(toDto(foundDoc!)).toEqual(toDto(newDoc))
            })
        })

        describe('when the required fields are missing', () => {
            it('throws an error', async () => {
                const doc = fixture.repository.newDocument()
                const promise = doc.save()
                await expect(promise).rejects.toThrow()
            })
        })
    })

    describe('update', () => {
        describe('when updating a document', () => {
            it('updates the document', async () => {
                const persistedDoc = fixture.repository.newDocument()
                persistedDoc.name = 'new name'
                await persistedDoc.save()

                await fixture.repository.update(persistedDoc.id, { name: 'updated name' })

                const updatedDoc = await fixture.repository.findById(persistedDoc.id)

                expect(updatedDoc?.name).toEqual('updated name')
            })
        })
    })

    describe('saveMany', () => {
        describe('when creating multiple documents', () => {
            it('creates all documents', async () => {
                const docs = [
                    { name: 'document-1' },
                    { name: 'document-2' },
                    { name: 'document-2' }
                ].map((data) => {
                    const doc = fixture.repository.newDocument()
                    doc.name = data.name
                    return doc
                })

                const saveSucceeded = await fixture.repository.saveMany(docs)

                expect(saveSucceeded).toBe(true)
            })
        })

        describe('when any document is missing required fields', () => {
            it('throws an error', async () => {
                const docs = [fixture.repository.newDocument(), fixture.repository.newDocument()]

                const promise = fixture.repository.saveMany(docs)

                await expect(promise).rejects.toThrow()
            })
        })
    })

    describe('findWithPagination', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const { createSamples } = await import('./mongoose.repository.fixture')

            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        describe('when paginating results', () => {
            it('returns items with correct pagination', async () => {
                const skip = 10
                const take = 5
                const { items, ...pagination } = await fixture.repository.findWithPagination({
                    pagination: {
                        skip,
                        take,
                        orderby: { name: 'name', direction: OrderDirection.Asc }
                    }
                })

                sortByName(samples)
                expect(samples.slice(skip, skip + take)).toEqual(toDtos(items))
                expect(pagination).toEqual({ total: samples.length, skip, take })
            })
        })

        describe('when sorting in ascending order', () => {
            it('sorts in ascending order', async () => {
                const { items } = await fixture.repository.findWithPagination({
                    pagination: {
                        take: samples.length,
                        orderby: { name: 'name', direction: OrderDirection.Asc }
                    }
                })

                sortByName(samples)
                expect(toDtos(items)).toEqual(samples)
            })
        })

        describe('when sorting in descending order', () => {
            it('sorts in descending order', async () => {
                const { items } = await fixture.repository.findWithPagination({
                    pagination: {
                        take: samples.length,
                        orderby: { name: 'name', direction: OrderDirection.Desc }
                    }
                })

                sortByNameDescending(samples)
                expect(toDtos(items)).toEqual(samples)
            })
        })

        describe('when the take value is not positive', () => {
            it('throws an error', async () => {
                const promise = fixture.repository.findWithPagination({ pagination: { take: -1 } })

                await expect(promise).rejects.toThrow(fixture.BadRequestException)
            })
        })

        describe('when the take value exceeds the limit', () => {
            it('throws a BadRequest', async () => {
                const take = maxTake + 1

                const promise = fixture.repository.findWithPagination({ pagination: { take } })

                await expect(promise).rejects.toThrow(fixture.BadRequestException)
            })
        })

        describe('when the take value is not specified', () => {
            it('uses the default take value', async () => {
                const { take } = await fixture.repository.findWithPagination({
                    pagination: { orderby: { name: 'name', direction: OrderDirection.Desc } }
                })

                expect(take).toEqual(maxTake)
            })
        })

        describe('when the QueryHelper configures conditions', () => {
            it('applies the configured conditions', async () => {
                const { items } = await fixture.repository.findWithPagination({
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
    })

    describe('allExistByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        describe('when all ids exist', () => {
            it('returns true', async () => {
                const exists = await fixture.repository.allExistByIds(pickIds(samples))
                expect(exists).toBe(true)
            })
        })

        describe('when any id does not exist', () => {
            it('returns false', async () => {
                const exists = await fixture.repository.allExistByIds([nullObjectId])
                expect(exists).toBe(false)
            })
        })
    })

    describe('findById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fixture.repository)
            sample = toDto(doc)
        })

        describe('when the id exists', () => {
            it('returns the document', async () => {
                const doc = await fixture.repository.findById(sample.id)

                expect(toDto(doc!)).toEqual(sample)
            })
        })

        describe('when the id does not exist', () => {
            it('returns null', async () => {
                const doc = await fixture.repository.findById(nullObjectId)

                expect(doc).toBeNull()
            })
        })
    })

    describe('findByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        describe('when the ids exist', () => {
            it('returns the documents', async () => {
                const ids = pickIds(samples)
                const docs = await fixture.repository.findByIds(ids)

                expectEqualUnsorted(toDtos(docs), samples)
            })
        })

        describe('when the ids include missing documents', () => {
            it('ignores missing ids', async () => {
                const docs = await fixture.repository.findByIds([nullObjectId])
                expect(docs).toHaveLength(0)
            })
        })
    })

    describe('getById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fixture.repository)
            sample = toDto(doc)
        })

        describe('when the id exists', () => {
            it('returns the document', async () => {
                const doc = await fixture.repository.getById(sample.id)

                expect(toDto(doc)).toEqual(sample)
            })
        })

        describe('when the id does not exist', () => {
            it('throws NotFoundException', async () => {
                const promise = fixture.repository.getById(nullObjectId)

                await expect(promise).rejects.toThrow(fixture.NotFoundException)
            })
        })
    })

    describe('getByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        describe('when all ids exist', () => {
            it('returns the documents', async () => {
                const ids = pickIds(samples)
                const docs = await fixture.repository.getByIds(ids)

                expectEqualUnsorted(toDtos(docs), samples)
            })
        })

        describe('when any id is missing', () => {
            it('throws NotFoundException', async () => {
                const promise = fixture.repository.getByIds([nullObjectId])

                await expect(promise).rejects.toThrow(fixture.NotFoundException)
            })
        })
    })

    describe('deleteById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fixture.repository)
            sample = toDto(doc)
        })

        describe('when the id exists', () => {
            it('deletes the document', async () => {
                await fixture.repository.deleteById(sample.id)
                const doc = await fixture.repository.findById(sample.id)

                expect(doc).toBeNull()
            })
        })

        describe('when the id does not exist', () => {
            it('throws NotFoundException', async () => {
                const promise = fixture.repository.deleteById(nullObjectId)

                await expect(promise).rejects.toThrow(fixture.NotFoundException)
            })
        })
    })

    describe('deleteByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        describe('when all ids exist', () => {
            it('deletes the documents', async () => {
                const samplesToDelete = samples.slice(5, 10)
                const ids = pickIds(samplesToDelete)

                const deletedDocs = await fixture.repository.deleteByIds(ids)
                expect(toDtos(deletedDocs)).toEqual(samplesToDelete)

                const docs = await fixture.repository.findByIds(ids)
                expect(docs).toHaveLength(0)
            })
        })

        describe('when any id is missing', () => {
            it('throws NotFoundException', async () => {
                const promise = fixture.repository.deleteByIds([nullObjectId])

                const error = await promise.catch((e) => e)

                expect(error).toBeInstanceOf(fixture.NotFoundException)
                expect(error.response).toEqual({
                    ...MongooseErrors.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
            })
        })
    })
})
