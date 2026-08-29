const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const { createJestResourceScope } = require('@mannercode/jest-helpers')

const RUN_ID = '0123456789abcdef0123456789abcdef'
const setupPath = path.resolve(__dirname, '../../jest.setup.cjs')

test('actual jest.setup은 app 모듈을 처음 읽기 전에 run-scoped PROJECT_ID를 설정한다', async () => {
    const originalLoad = Module._load
    const originalHooks = {
        afterAll: global.afterAll,
        afterEach: global.afterEach,
        beforeAll: global.beforeAll,
        beforeEach: global.beforeEach
    }
    const previousEnvironment = {
        API_JEST_RUN_ID: process.env.API_JEST_RUN_ID,
        JEST_WORKER_ID: process.env.JEST_WORKER_ID,
        PROJECT_ID: process.env.PROJECT_ID,
        TEST_ID: process.env.TEST_ID
    }
    const hooks = { afterAll: [], afterEach: [], beforeAll: [], beforeEach: [] }
    let projectIdAtFirstAppModuleLoad

    for (const hookName of Object.keys(hooks)) {
        global[hookName] = (callback) => hooks[hookName].push(callback)
    }
    process.env.API_JEST_RUN_ID = RUN_ID
    process.env.JEST_WORKER_ID = '1'
    process.env.PROJECT_ID = 'shared-project-from-env'
    delete process.env.TEST_ID

    Module._load = function loadWithSetupDependenciesMocked(request, parent, isMain) {
        if (parent?.filename === setupPath && request === './src/config/mongo-driver-options') {
            projectIdAtFirstAppModuleLoad = process.env.PROJECT_ID
            return { createMongoDriverOptions: () => ({}) }
        }
        if (parent?.filename === setupPath && request === './src/modules/mongoose-setup.module') {
            return { registerMongoClientDiagnostics() {} }
        }
        if (parent?.filename === setupPath && request === './scripts') {
            return {
                attachSharedTestMongooseConnection() {},
                clearSharedTestMongooseConnection() {}
            }
        }
        return Reflect.apply(originalLoad, this, [request, parent, isMain])
    }

    try {
        delete require.cache[setupPath]
        require(setupPath)

        const resourceScope = createJestResourceScope(RUN_ID)
        const startupProjectId = resourceScope.projectId('startup-w1')
        assert.equal(projectIdAtFirstAppModuleLoad, startupProjectId)
        assert.equal(process.env.PROJECT_ID, startupProjectId)

        assert.equal(hooks.beforeEach.length, 1)
        await hooks.beforeEach[0]()
        assert.match(process.env.TEST_ID, /^[A-Za-z0-9]{10}$/)
        assert.equal(process.env.PROJECT_ID, resourceScope.projectId(process.env.TEST_ID))
        assert.notEqual(process.env.PROJECT_ID, startupProjectId)
    } finally {
        Module._load = originalLoad
        delete require.cache[setupPath]
        Object.assign(global, originalHooks)
        restoreEnvironment(previousEnvironment)
    }
})

function restoreEnvironment(previousEnvironment) {
    for (const [name, value] of Object.entries(previousEnvironment)) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
    }
}
