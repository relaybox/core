# Core - RelayBox Realtime Application Service Built on uWebSockets.js

The Core service is a realtime websocket server written in NodeJS, built on top of the powerful uWebSockets.js by [uNetworking](https://github.com/uNetworking). The service is designed to provide a reliable and scalable websocket server for realtime applications.

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

## About "Core"

The Core service is the beating heart of the RelayBox system. Responsibilities include orchestrating realtime components from subscription bindings to generating and managing message broker queues and routing keys. It interacts with the auth service directly to define access parameters and guards against unauthorized access to operations based on complex permissions rules.

![RelayBox system architecture](/assets/system/relaybox-system-core.png)

## Modular Architecture

This service is split into various modules that handle different operations used by the system. The modules themselves are located in the `./src/modules` directory and consist of:

- `auth`

Handles auth token and API key verification via the [Auth Service](https://github.com/relaybox/auth). Works in conjunction with the "session" module to verify and control access to the system.

- `events`

Handles external events published over http. Responsible for verifying the request signature and dispatching the event to appropriate subscribers.

- `history`

Handles the retreival of historical messages for a specific room using the passed paramaters. For more information about event history and message retention, please refer to the technical documentation [here](https://relaybox.net/docs/api-reference/relaybox-client/rooms#room-history-get) or for an overview refer to [this section](https://relaybox.net/docs/history).

- `metrics`

Subscription handler for metrics events. The `metrics` module is responsible for handling metrics event subscriptions and enqueuing metrics data messages processed by the RelayBox [Metrics Service](https://github.com/relaybox/metrics).

- `presence`

Subscription handler for presence events. The `presence` module is responsible for hadling presence event subscriptions and enqueuing presence data messages processed by the RelayBox [Presence Service](https://github.com/relaybox/presence). It also emits responses to presence state requests, such as `get()` and `getCount()`.

For more information about "presence", please refer to the technical documentation [here](https://relaybox.net/docs/api-reference/relaybox-client/rooms#room-presence-join) or for an overview refer to [this section](https://relaybox.net/docs/presence).

- `room`

Handles room events such as "join", "leave" and "publish". This module maintains the cached rooms for a given connection to enable restore functionality when a connection is re-established.

It also handles publishing messages recieved from client input via `amqp-manager` (more on this shortly)

- `session`

Handles the session lifecycle from connection initialization to destroying the session on disconnect. This module works in conjunction with the auth module to verify auth tokens and allow access to the service.

It also controls messages passed to the [Session Service](https://github.com/relaybox/presence) that handles session heartbeats and maintains the session database.

- `subscription`

The subscription module is a more generic module that handles the actual subscription binding and unbinding process used by the `room`, `presence` and `metrics` modules.

Each time a subscripton is created, the service will subscribe the socket and create an entry at the relevant cache key. Likewise, when a subscription is deleted, the service will unsubscribe the socket and remove the entry from the cache.

Essentially, the module acts as a central point for managing subscriptions.

- `user`

The user module handles subscriptions to individual user events and is responsible for dipsatching user status updates via `amqp-manager` (more on this shortly).

- `guards`

The guards module is a collection of helper functions that are used to verify the permissions of a given user prior to perfoming actions via the other modules in the system.

Examples of guards include `authenticatedSessionGuard()` and `roomMemberGuard()`.

- `websocket`

The websocket module is the entry point for access to the system. It's main responsibility to to route incoming connections and messages to the appropriate module based on the message event type.

It also handles the websocket handshake, subscription bindings, connection upgrade and disconnection events.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This project includes components licensed under the Apache License 2.0. See [`LICENSE-APACHE-2.0.txt`](LICENSE-APACHE-2.0.txt) for details.
