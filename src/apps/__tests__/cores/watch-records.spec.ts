import { WatchRecordDto } from 'apps/cores'
import { oid } from 'testlib'
import { buildCreateWatchRecordDto, createWatchRecord } from '../__helpers__'
import type { WatchRecordsFixture } from './watch-records.fixture'

describe('WatchRecordsService', () => {
    let fixture: WatchRecordsFixture

    beforeEach(async () => {
        const { createWatchRecordsFixture } = await import('./watch-records.fixture')
        fixture = await createWatchRecordsFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('create', () => {
        describe('when the payload is valid', () => {
            const payload = buildCreateWatchRecordDto()

            it('returns the created watch record', async () => {
                const watchRecord = await fixture.watchRecordsService.create(payload)

                expect(watchRecord).toEqual({ ...payload, id: expect.any(String) })
            })
        })
    })

    describe('searchPage', () => {
        const customerId = oid(0xa1)
        let watchRecords: WatchRecordDto[]

        beforeEach(async () => {
            watchRecords = await Promise.all([
                createWatchRecord(fixture, { customerId }),
                createWatchRecord(fixture, { customerId }),
                createWatchRecord(fixture, { customerId }),
                createWatchRecord(fixture, { customerId })
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
                const pagination = await fixture.watchRecordsService.searchPage({ customerId })

                expect(pagination).toEqual(buildExpectedPage(watchRecords))
            })
        })
    })
})
