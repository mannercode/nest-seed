import { SearchWatchRecordsPageDto, WatchRecordDto } from 'apps/cores'
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
        it('returns the created watch record', async () => {
            const createDto = buildCreateWatchRecordDto()
            const watchRecord = await fix.watchRecordsService.create(createDto)

            expect(watchRecord).toEqual({ ...createDto, id: expect.any(String) })
        })
    })

    describe('searchPage', () => {
        const customerId = oid(0xa1)
        let watchRecords: WatchRecordDto[]

        beforeEach(async () => {
            watchRecords = await Promise.all([
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, {}),
                createWatchRecord(fix, {})
            ])
        })

        const buildExpectedPage = (watchRecords: WatchRecordDto[]) => ({
            skip: 0,
            take: expect.any(Number),
            total: watchRecords.length,
            items: expect.arrayContaining(watchRecords)
        })

        describe('when the filter is provided', () => {
            const queryAndExpect = async (
                query: SearchWatchRecordsPageDto,
                watchRecords: WatchRecordDto[]
            ) => {
                const page = await fix.watchRecordsService.searchPage(query)
                expect(page).toEqual(buildExpectedPage(watchRecords))
            }

            it('returns records filtered by customerId', async () => {
                await queryAndExpect({ customerId }, [watchRecords[0], watchRecords[1]])
            })
        })
    })
})
