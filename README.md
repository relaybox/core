# uWS - Realtime Application Service Built on uWebSockets.js by RelayBox

The uWS service is a relatime websocket server written in NodeJS, built on top of the powerful uWebSockets.js by [uNetworking](https://github.com/uNetworking). The service is designed to provide a reliable and scalable websocket server for realtime applications.

## Getting Started

Create a copy of `.env.template` in the root of the project and rename it to `.env`. Adjust the configuration settings to match your local environment. Further information about each environment variable can be found in `.env.template`.

> Recommended: Fork and/or clone [relaybox-local](https://github.com/relaybox/relaybox-local) to easily spin up the required resources for local development.

## Installation

To install the necessary dependencies, simply run...

```
npm install
```

Once complete, the dev environment is ready to go. To start the service, run the following command...

```
SERVER_PORT=5004 npm run dev
```

> Please note: If you are using [relaybox-local](https://github.com/relaybox/relaybox-local), be sure that SERVER_PORT matches the upstream port defined in the proxy configuration (defaults to 5004).

The websocket server should start on port 5004 and perform the necessary bootstrapping and config setup.

## Testing

The service unit tests can be found in the `./test` directory. Tests are run using the `vitest` runner.

```
npm run test
```

## About "uWS"

This service is split into various modules that handle different operations used by the system. The modules themselves are located in the `./src/modules` directory and consist of:

- `auth`

Handles auth token and API key verification via the [RelayBox Auth Service](https://github.com/relaybox/auth). Works in conjunction with the "session" module to verify and control access to the system.

- `events` - Handles event publishing and subscriptions.

Handles external events published over http. Responsible for verifying the request signature and dispatching the event to appropriate subscribers.

- `history`

Handles the retreival of historical messages for a specific room using the passed paramaters. For more information about event history and message retention, please refer to the technical documentation [here](https://relaybox.net/docs/api-reference/relaybox-client/rooms#room-history-get) or for an overview refer to [this section](https://relaybox.net/docs/history).

- `metrics` - Handles metrics collection and publishing.

Subscription handler for metrics events. The `metrics` module is responsible for handling metrics event subscriptions and enqueuing metrics data messages processed by the RelayBox [Metrics Service](https://github.com/relaybox/metrics).

- `presence`

Subscription handler for presence events. The `presence` module is responsible for hadling presence event subscriptions and enqueuing presence data messages processed by the RelayBox [Presence Service](https://github.com/relaybox/presence). It also emits responses to presence stats requests, such as `get()` and `getCount()`.

For more information about "presence", please refer to the technical documentation [here](https://relaybox.net/docs/api-reference/relaybox-client/rooms#room-presence-join) or for an overview refer to [this section](https://relaybox.net/docs/presence).

- `publisher` - Handles message publishing.
- `room` - Handles room management.
- `session` - Handles session management.
- `subscription` - Handles subscription management.
- `user` - Handles user management.
