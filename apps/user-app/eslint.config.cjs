// user 앱도 Next.js 프로젝트라 공용 Node 설정과 맞지 않는다.
// typescript-eslint 추천 규칙만 가볍게 적용한다. 타입 검사는 tsc, 포맷은 prettier가 본다.
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
