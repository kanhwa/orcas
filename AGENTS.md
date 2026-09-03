# ORCAS Server Start Instructions

When asked to start the backend and frontend servers for this project:

- You MUST run `./scripts/dev_start.sh` with `BypassSandbox: true` in your `run_command` tool so that the servers can bind to the host's network and be accessible by the user.
- If you run them inside the sandbox without `BypassSandbox: true`, the user will not be able to access `localhost:5173` or `localhost:8000` because the sandbox isolates the network.
- To stop the servers, you can run `./scripts/dev_stop.sh` with `BypassSandbox: true`.
