import { expect } from '@jest/globals'
import { getMongoTestConnection, HttpTestContext } from 'testlib'
import { createFixture, SamplesRepository } from './mongoose.transaction.fixture'

describe('MongooseRepository - withTransaction', () => {
    let testContext: HttpTestContext
    let repository: SamplesRepository

    beforeEach(async () => {
        const uri = getMongoTestConnection()

        const fixture = await createFixture(uri)
        testContext = fixture.testContext
        repository = fixture.repository
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('commit a transaction', async () => {
        const newDoc = await repository.withTransaction(async (session) => {
            const doc = repository.newDocument()
            doc.name = 'name'
            return doc.save({ session })
        })

        const found = await repository.findById(newDoc.id)
        expect(found?.toJSON()).toEqual(newDoc.toJSON())
    })

    it('should rollback changes when an exception occurs during a transaction', async () => {
        const promise = repository.withTransaction(async (session) => {
            const doc = repository.newDocument()
            doc.name = 'name'
            await doc.save({ session })

            throw new Error('An error occurred during the transaction.')
        })

        await expect(promise).rejects.toThrowError()

        const { total } = await repository.findWithPagination({ pagination: { take: 1 } })
        expect(total).toEqual(0)
    })

    it('rollback a transaction', async () => {
        const newDoc = repository.newDocument()
        newDoc.name = 'name'
        await newDoc.save()

        await repository.withTransaction(async (session, rollback) => {
            await repository.deleteById(newDoc.id, session)
            rollback()
        })

        const found = await repository.findById(newDoc.id)
        expect(found?.toJSON()).toEqual(newDoc.toJSON())
    })
})
