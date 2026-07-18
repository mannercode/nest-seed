// Next.js 앱에는 백엔드용 공용 Node 규칙 대신 typescript-eslint 권장 규칙만 적용한다.
const tseslint = require('typescript-eslint')

module.exports = [
    { ignores: ['.next/**', 'node_modules/**', '_output/**', 'next-env.d.ts'] },
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: { sourceType: 'module', ecmaFeatures: { jsx: true } }
        },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: { ...tseslint.plugin.configs.recommended.rules }
    }
]
