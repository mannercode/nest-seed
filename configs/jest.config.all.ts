import type { Config } from 'jest'
import baseOption from './jest.config'

const config: Config = {
    ...baseOption,
    roots: ['<rootDir>/src/apps', '<rootDir>/src/libs'],
    collectCoverageFrom: [
        'apps/**/*.ts',
        '!apps/**/src/*.ts',
        '!apps/**/*.controller.ts',
        'libs/common/src/**/*.ts',
        '!**/index.ts',
        '!**/*.module.ts'
    ]
}

export default config
