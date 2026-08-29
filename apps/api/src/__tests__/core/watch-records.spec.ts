import { ensure } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import type { WatchRecordDto, WatchRecordsService } from '#core'
import {
    buildCreateWatchRecordDto,
    createWatchRecord,
    type AppTestContext
} from '../helpers/index.js'

describe('WatchRecordsService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let watchRecordsService: WatchRecordsService

    beforeEach(async () => {
        teardown = undefined
        const { createAppTestContext } = await import('../helpers/index.js')
        const { WatchRecordsService } = await import('#core')
        fix = await createAppTestContext()
        teardown = fix.teardown
        watchRecordsService = fix.module.get(WatchRecordsService)
    })
    afterEach(() => teardown?.())

    describe('create', () => {
        it('생성된 시청 기록을 반환한다', async () => {
            const createDto = buildCreateWatchRecordDto()
            const watchRecord = await watchRecordsService.create(createDto)

            expect(watchRecord).toEqual({ ...createDto, id: expect.any(String) })
        })
    })

    describe('searchPage', () => {
        const userId = oid(0xa1)
        let watchRecords: WatchRecordDto[]

        beforeEach(async () => {
            watchRecords = await Promise.all([
                createWatchRecord(fix, { userId }),
                createWatchRecord(fix, { userId }),
                createWatchRecord(fix, {}),
                createWatchRecord(fix, {})
            ])
        })

        const buildExpectedPage = (expectedRecords: WatchRecordDto[]) => ({
            items: expect.arrayContaining(expectedRecords),
            page: expect.any(Number),
            size: expect.any(Number),
            total: expectedRecords.length
        })

        it('userId가 일치하는 기록만 반환한다', async () => {
            const recordsPage = await watchRecordsService.searchPage({ userId })

            expect(recordsPage.items).toHaveLength(2)
            expect(recordsPage).toEqual(
                buildExpectedPage([ensure(watchRecords[0]), ensure(watchRecords[1])])
            )
        })
    })
})
