import type { MongooseTransactionFixture } from './mongoose-transaction.fixture'

describe('Mongoose Transaction', () => {
    let fix: MongooseTransactionFixture

    beforeEach(async () => {
        const { createMongooseTransactionFixture } = await import('./mongoose-transaction.fixture')
        fix = await createMongooseTransactionFixture()
    })
    afterEach(() => fix.teardown())

    describe('withTransaction', () => {
        it('콜백이 성공하면 커밋한다', async () => {
            const newDoc = await fix.repository.withTransaction(async (session) => {
                const doc = fix.repository.newDocument()
                doc.name = 'name'
                return doc.save({ session })
            })

            const found = await fix.repository.findById(newDoc.id)
            expect(found).toMatchObject({ id: newDoc.id, name: newDoc.name })
        })

        it('콜백이 예외를 던지면 변경 사항을 롤백한다', async () => {
            const promise = fix.repository.withTransaction(async (session) => {
                const doc = fix.repository.newDocument()
                doc.name = 'name'
                await doc.save({ session })

                throw new Error('An error occurred during the transaction.')
            })

            await expect(promise).rejects.toThrow()

            const { total } = await fix.repository.findWithPagination({ pagination: {} })
            expect(total).toEqual(0)
        })
    })

    describe('일시 트랜잭션 오류 재시도', () => {
        it('동시 트랜잭션의 WriteConflict는 재시도 끝에 성공한다', async () => {
            const doc = fix.repository.newDocument()
            doc.name = 'initial'
            await doc.save()

            let release!: () => void
            const holdOpen = new Promise<void>((resolve) => (release = resolve))
            let firstWriteDone!: () => void
            const firstWrite = new Promise<void>((resolve) => (firstWriteDone = resolve))

            // 첫 트랜잭션이 문서를 잡은 채 열려 있는 동안 같은 문서를 쓰면 WriteConflict가 난다.
            const first = fix.repository.withTransaction(async (session) => {
                await fix.model.updateOne(
                    { _id: doc._id },
                    { $set: { name: 'first' } },
                    { session }
                )
                firstWriteDone()
                await holdOpen
            })
            await firstWrite

            let attempts = 0
            await fix.repository.withTransaction(async (session) => {
                attempts++
                if (attempts === 2) {
                    // 재시도 전에 경쟁 트랜잭션을 끝내, 두 번째 시도가 성공하는 경로를 만든다.
                    release()
                    await first
                }
                await fix.model.updateOne(
                    { _id: doc._id },
                    { $set: { name: 'second' } },
                    { session }
                )
            })

            expect(attempts).toEqual(2)
            const found = await fix.repository.findById(doc.id)
            expect(found).toMatchObject({ name: 'second' })
        })

        it('일시 오류가 아니면 재시도하지 않고 그대로 던진다', async () => {
            let attempts = 0
            const promise = fix.repository.withTransaction(async () => {
                attempts++
                throw new Error('boom')
            })

            await expect(promise).rejects.toThrow('boom')
            expect(attempts).toEqual(1)
        })
    })
})
