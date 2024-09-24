import type { Config } from 'jest'
import baseOption from './jest.config'

const config: Config = {
    ...baseOption,
    rootDir: '.',
    roots: ['<rootDir>/src/app'],
    collectCoverageFrom: [
        'src/app/**/*.ts',
        '!**/main.ts',
        '!**/index.ts',
        '!**/*.module.ts'
    ]
}

export default config
