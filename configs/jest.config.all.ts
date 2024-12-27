import type { Config } from 'jest'
import baseOption from '../jest.config'

const config: Config = {
    ...baseOption,
    rootDir: '..',
    roots: ['<rootDir>/src'],
    collectCoverageFrom: [
        'src/apps/**/*.ts',
        'src/libs/common/**/*.ts',
        ...baseOption.collectCoverageFrom!
    ]
}

export default config
