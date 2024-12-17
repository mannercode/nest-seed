import type { Config } from 'jest'
import baseOption from './jest.config'

const config: Config = {
    ...baseOption,
    rootDir: '.',
    roots: ['<rootDir>/apps'],
    collectCoverageFrom: [
        'apps/**/*.ts',
        '!apps/**/index.ts',
        '!apps/**/*.module.ts',
        '!apps/**/src/*.ts',
        '!apps/**/*.controller.ts'
    ]
}

export default config
