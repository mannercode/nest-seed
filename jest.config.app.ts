import type { Config } from 'jest'
import baseOption from './jest.config'

const config: Config = {
    ...baseOption,
    rootDir: '.',
    roots: ['<rootDir>/src/app'],
    collectCoverageFrom: [
        'src/app/**/*.ts',
        '!src/app/*.ts',
        '!**/index.ts',
        '!**/*.module.ts',
    ]
}

export default config
