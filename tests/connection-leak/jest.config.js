// 단순 jest config — apps/api 의 transform/path alias 안 빌리고 .test.js
// 만 실행. native client 별로 connect/close 반복하며 메모리 누수 측정.
module.exports = {
    testEnvironment: 'node',
    rootDir: __dirname,
    testMatch: ['**/*.test.js'],
    testTimeout: 5 * 60 * 1000,
    resetModules: false
}
