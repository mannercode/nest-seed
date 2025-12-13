import { WatchRecordDto } from 'apps/cores'
import { oid } from 'testlib'
import { buildCreateWatchRecordDto, createWatchRecord } from '../__helpers__'
import type { WatchRecordsFixture } from './watch-records.fixture'

describe('WatchRecordsService', () => {
    let fix: WatchRecordsFixture

    beforeEach(async () => {
        const { createWatchRecordsFixture } = await import('./watch-records.fixture')
        fix = await createWatchRecordsFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('create', () => {
        describe('when the payload is valid', () => {
            const payload = buildCreateWatchRecordDto()

            it('returns the created watch record', async () => {
                const watchRecord = await fix.watchRecordsService.create(payload)

                expect(watchRecord).toEqual({ ...payload, id: expect.any(String) })
            })
        })
    })

    describe('searchPage', () => {
        const customerId = oid(0xa1)
        let watchRecords: WatchRecordDto[]

        beforeEach(async () => {
            watchRecords = await Promise.all([
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId })
            ])
        })

        const buildExpectedPage = (watchRecords: WatchRecordDto[]) => ({
            skip: 0,
            take: expect.any(Number),
            total: watchRecords.length,
            items: expect.arrayContaining(watchRecords)
        })

        describe('when the `customerId` is provided', () => {
            it('returns paginated records for the customerId', async () => {
                const pagination = await fix.watchRecordsService.searchPage({ customerId })

                expect(pagination).toEqual(buildExpectedPage(watchRecords))
            })
        })
    })
})
