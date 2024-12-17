import type { Config } from 'jest'
import baseOption from '../../jest.config'

const config: Config = {
    ...baseOption,
    rootDir: '../../',
    roots: ['<rootDir>/libs/common/src'],
    collectCoverageFrom: ['libs/common/src/**/*.ts', '!**/index.ts', '!**/*.module.ts']
}

export default config