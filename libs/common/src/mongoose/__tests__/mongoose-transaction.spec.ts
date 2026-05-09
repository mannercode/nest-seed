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

        it('rollback()을 호출하면 롤백한다', async () => {
            const newDoc = fix.repository.newDocument()
            newDoc.name = 'name'
            await newDoc.save()

            await fix.repository.withTransaction(async (session, rollback) => {
                await fix.repository.deleteById(newDoc.id, session)
                rollback()
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

        it('rollback() 호출 시 커밋이 아닌 중단으로 종료된다', async () => {
            // session.abortTransaction이 호출되고 commitTransaction은 호출되지 않는지 확인.
            const fakeSession = {
                abortTransaction: jest.fn().mockResolvedValue(undefined),
                commitTransaction: jest.fn().mockResolvedValue(undefined),
                endSession: jest.fn().mockResolvedValue(undefined),
                inTransaction: jest.fn().mockReturnValue(true),
                startTransaction: jest.fn()
            }
            jest.spyOn(fix.model, 'startSession').mockResolvedValue(fakeSession as any)

            await fix.repository.withTransaction(async (_session, rollback) => {
                rollback()
            })

            expect(fakeSession.abortTransaction).toHaveBeenCalledTimes(1)
            expect(fakeSession.commitTransaction).not.toHaveBeenCalled()
        })

        it('endSession()이 예외를 던지면 호출자가 그 예외를 받는다', async () => {
            const fakeSession = {
                abortTransaction: jest.fn().mockResolvedValue(undefined),
                commitTransaction: jest.fn().mockResolvedValue(undefined),
                endSession: jest.fn().mockRejectedValue(new Error('endSession failed')),
                inTransaction: jest.fn().mockReturnValue(true),
                startTransaction: jest.fn()
            }
            jest.spyOn(fix.model, 'startSession').mockResolvedValue(fakeSession as any)

            await expect(fix.repository.withTransaction(async () => 'ok')).rejects.toThrow(
                'endSession failed'
            )

            expect(fakeSession.endSession).toHaveBeenCalledTimes(1)
        })
    })

    describe('에러 처리', () => {
        it('startSession이 예외를 던지면 예외를 전파한다', async () => {
            jest.spyOn(fix.model, 'startSession').mockImplementation(() => {
                throw new Error()
            })

            const promise = fix.repository.withTransaction(async (_session) => {})

            await expect(promise).rejects.toThrow()
        })

        it('startTransaction이 예외를 던지면 예외를 전파한다', async () => {
            jest.spyOn(fix.model, 'startSession').mockResolvedValue({
                inTransaction: jest.fn().mockReturnValue(false),
                startTransaction: jest.fn().mockImplementation(() => {
                    throw new Error()
                })
            } as any)

            const promise = fix.repository.withTransaction(async (_session) => {})

            await expect(promise).rejects.toThrow()
        })
    })
})
