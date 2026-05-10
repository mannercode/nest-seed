// movies.spec.ts 와 같은 패턴: beforeEach 로 매 it 마다 createAppTestContext
// 부팅 + afterEach teardown. 비즈니스 로직 없음 (it 안에 noop). 누수가
// fixture+it 격리 (resetModules:true) 조합에서 오는지 확인.
import { createAppTestContext, type AppTestContext } from '../../apps/api/src/__tests__/integration/helpers'

let fix: AppTestContext

beforeEach(async () => {
    fix = await createAppTestContext()
})

afterEach(async () => {
    await fix.teardown()
})

describe('fixture-per-it (no business logic)', () => {
    for (let i = 1; i <= 20; i++) {
        it(`noop ${i}`, () => {
            expect(1).toBe(1)
        })
    }
})
