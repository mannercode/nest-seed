import { expect } from '@jest/globals'
import { CloseFixture } from 'testlib'
import { SamplesRepository } from './mongoose.transaction.fixture'

describe('MongooseRepository - withTransaction', () => {
    let closeFixture: CloseFixture
    let repository: SamplesRepository

    beforeEach(async () => {
        const { createFixture } = await import('./mongoose.transaction.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        repository = fixture.repository
    })

    afterEach(async () => {
        await closeFixture?.()
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

    it('트랜잭션 중 예외가 발생하면 변경 사항을 롤백해야 한다', async () => {
        const promise = repository.withTransaction(async (session) => {
            const doc = repository.newDocument()
            doc.name = 'name'
            await doc.save({ session })

            throw new Error('An error occurred during the transaction.')
        })

        await expect(promise).rejects.toThrow()

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
