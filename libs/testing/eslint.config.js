const path = require('path')
const { createBaseConfigs } = require('../../eslint.config.base')

// tsconfig.json 은 libs/ 부모에 있다 (include: ["*/src/**/*"] 로 common 과
// testing 둘 다 커버). 이 패키지 하위 파일에 대해 tsc-aware rule 이 project 를
// 찾을 수 있도록 projectService 를 거기로 가리킨다.
module.exports = createBaseConfigs({ tsconfigRootDir: path.join(__dirname, '..') })
