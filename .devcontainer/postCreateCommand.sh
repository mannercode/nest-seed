set -euo pipefail
cd $WORKSPACE_ROOT

nohup java -jar /opt/plantuml.jar -picoweb:5020 > /tmp/plantuml.log 2>&1 &

npx husky

bash scripts/reset-infra.sh
npm ci
