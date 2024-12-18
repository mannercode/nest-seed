import type { Config } from 'jest'
import baseOption from './jest.config'

const config: Config = {
    ...baseOption,
    roots: ['<rootDir>/src/apps'],
    collectCoverageFrom: [
        'src/apps/**/*.ts',
        '!src/apps/**/index.ts',
        '!src/apps/**/*.module.ts',
        '!src/apps/**/src/*.ts',
        '!src/apps/**/*.controller.ts'
    ]
}

export default config
