# UWS - Realtime Application Service Built on uWebSockets.js by RelayBox

The UWS service is a relatime websocket server written in NodeJS, built on top of the powerful uWebSockets.js by [uNetworking](https://github.com/uNetworking). The service is designed to provide a reliable and scalable websocket server for realtime applications.

## Quick Start

Create a copy of .env.tempate in the root of the project and rename it to .env. Add the following configuration options...

```
# Local DB host
DB_HOST=

# Local DB idle timeout
DB_IDLE_TIMEOUT_MS=

# Local DB max connections
DB_MAX_CONNECTIONS=

# Local DB name
DB_NAME=

# Local DB password
DB_PASSWORD=

# Local DB port
DB_PORT=

# Local DB proxy enabled - Set to false for local development
DB_PROXY_ENABLED=

# Local DB user
DB_USER=

# Local DB TLS disabled - Set to true for local development unless connecttion over TLS
DB_TLS_DISABLED=

# Local Redis host
REDIS_HOST=

# Local Redis port
REDIS_PORT=

# Local Redis TLS disabled - Set to true for local development unless connecttion over TLS
REDIS_TLS_DISABLED=

# Local RabbitMQ connection string
RABBIT_MQ_CONNECTION_STRING=

# Local RabbitMQ queue auto delete - Set to true unless testing specific feature
RABBIT_MQ_QUEUE_AUTO_DELETE=

# Recommended setting "5" - This value needs to be synced across services
RABBIT_MQ_QUEUE_COUNT=

# Local RelayBox Auth service URL
RELAYBOX_AUTH_SERVICE_URL=

# Localhost - Set to true for local development
LOCALHOST=

# Recommended setting "30000" - This value needs to be synced across services
WS_IDLE_TIMEOUT_MS=

# Desired log level - recommended setting "debug" for local development
LOG_LEVEL=
```

> Recommended: Fork and clone [relaybox-local](https://github.com/relaybox/relaybox-local) to easily spin up the required resources for local development.

## Installation

To install the necessary packages, simply run...

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

Unit tests are built using `vitest`.

```
npm run test
```
