import type { Config } from 'jest'
import baseOption from './jest.config'

const config: Config = {
    ...baseOption,
    roots: ['<rootDir>/src/libs/common'],
    collectCoverageFrom: ['src/libs/common/**/*.ts', '!src/**/index.ts', '!src/**/*.module.ts']
}

export default config
