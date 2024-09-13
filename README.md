# NEST-SEED

A template for starting NestJS projects, including essential features and configurations.

## Requirements

The following prerequisites must be installed on the host to run this project:

- Docker
- VSCode & extensions
- Dev Containers (ms-vscode-remote.remote-containers)

It is recommended to configure and use the "Remote - SSH" (ms-vscode-remote.remote-ssh) extension if possible.

> Windows environments are not supported. Windows users should run VSCode in Ubuntu using VMware.

## Changing the Project Name

To change the project name, review and modify the following settings as needed:

- .env.development
- devcontainer.json
  - forwardPorts
- package.json
  - name

## Development Environment Setup

After setting up [git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials) on the host, launch VSCode and the development environment will be configured automatically.

## Running the Development Environment

- Development tasks are defined in /.vscode/tasks.json
- Run "Menu/Terminal/Run Task..." to see related menus
- "Watch Start" and "Watch Test" should be running while modifying source code
- "Watch Start": Starts the Nest application in debug mode and automatically restarts on file changes
- "Watch Test": Runs test code and automatically re-runs tests on file changes

## Debugging

Debugging configurations are defined in /.vscode/launch.json

- To debug "Watch Start", run "Run and Debug/Attach to Start"
- To debug "Watch Test", run "Run and Debug/Attach to Test"
- If VSCode has the "Jest Runner" and "code lens" extensions installed, a "Run | Debug" menu will appear for Jest tests. Clicking "Debug" will automatically attach the debugger and run that test.

## Testing

- End-to-end tests are written as bash scripts
- Run `/test/e2e/run.sh`

## Production Deployment

To build and run for production:

```bash
$ npm test:all
$ npm run build
$ npm run start
```

## Guides

Important information not covered in the README:

- [Design Guide](./docs/guides/design.guide.md)
- [Problems with Feature Modules](./docs/guides/problems-with-feature-modules.md)
- [Implementation Guide](./docs/guides/implementation.guide.md)

## Known Issues

- To view UML diagrams in md files with "PlantUML Preview", the cursor must be between `@startuml` and `@enduml`
- If UML diagrams don't appear in "Preview markdown", secure settings may be needed. Click "..." in the upper right of the Preview screen to "change preview security setting"
- On Linux hosts, if running jest gives a "System limit for number of file watchers reached" error, run this script on the host:

```sh
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

- On Linux VMs running Docker containers with bridged networking, issues connecting to external networks may occur occasionally. Restarting Linux usually resolves this, but the root cause is unknown.
