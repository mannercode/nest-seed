import type { Config } from 'jest'
import baseOption from '../jest.config'

const config: Config = {
    ...baseOption,
    rootDir: '..',
    roots: ['<rootDir>/src/apps'],
    collectCoverageFrom: ['src/apps/**/*.ts', ...baseOption.collectCoverageFrom!]
}

export default config
