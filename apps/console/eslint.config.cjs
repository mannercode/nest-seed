// console은 Next.js 프로젝트라 공용 base 설정(`eslint.config.base.js`)의
// 백엔드 가정과 맞지 않는다. 그래서 가벼운 설정만 둔다. 타입 검사는
// `tsc --noEmit`으로 별도로 실행하고, husky pre-commit은 prettier 포맷만
// 강제한다.
module.exports = [{ ignores: ['.next/**', 'node_modules/**', '_output/**'] }]
