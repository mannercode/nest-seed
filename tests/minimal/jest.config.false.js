// resetModules:false — module registry 를 testFile 안에서 공유한다.
// resetModules:true 와 비교해서 누수 차이가 큰지 본다.
module.exports = {
    testEnvironment: 'node',
    rootDir: __dirname,
    testMatch: ['**/spec*.test.js'],
    resetModules: false,
    testTimeout: 60_000
}
