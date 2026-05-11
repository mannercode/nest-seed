// Console 은 Next.js 프로젝트로, 전사 base config (eslint.config.base.js) 의
// 백엔드 가정과 충돌해 별도의 가벼운 설정만 둔다. 빌드/타입체크는 `tsc --noEmit`
// 으로, husky pre-commit 은 prettier 포맷만 강제한다.
module.exports = [
    {
        ignores: ['.next/**', 'node_modules/**', '_output/**']
    }
]
