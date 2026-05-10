// resetModules:true — apps/api 와 같은 격리 모드. 매 it 시작 전 module
// registry 를 reset 한다. 진짜 누수원이라면 false 와 큰 차이가 나야 한다.
module.exports = {
    testEnvironment: 'node',
    rootDir: __dirname,
    testMatch: ['**/spec*.test.js'],
    resetModules: true,
    testTimeout: 60_000
}
