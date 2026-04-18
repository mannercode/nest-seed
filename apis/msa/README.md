# nest-msa

Microservice variant. The repo hosts three Nest applications (`applications`,
`cores`, `infrastructures`) in a single workspace. Each script that runs a
single app selects it through the `TARGET_APP` environment variable.

`TARGET_APP` must match a project key defined in
[`nest-cli.json`](./nest-cli.json).

```sh
TARGET_APP=cores npm run bundle
TARGET_APP=applications npm run dev
```
