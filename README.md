# Sesssion Management

## Session Destroy

Following a disconnection event the following actions take place...

## socket.close -> handleDisconnect()

Following a socket disconnection the following events take plkace to manage cleanup but allow for reconnection within a certain time period.

### Clearing session metrics

- **clearSessionMetrics -> MetricsJobName.METRICS_CLIENT_ROOM_LEAVE**

Metric stats relating to the session are cleared immediately to provide immediate feedback to subscribers. A reconnection following a disconnection will emit new metrics.

A job is added to the session queue to be picked up by the session service which handles the following...

- Unset all metrics including removing from metrics key lists by cached room id
- Persist room_sessions setting "leftAt" to timsetamp attched to message

### Handling session data destroy

- **markSessionForDeletion -> SessionJobName.SESSION_DESTROY (([idleTimeout] \* 4) ms delayed job)**

A delayed job is added to the session queue to clear cached room/subscription data. The delay is the length of the socket idle timeout \* 4.

> Why socket idle timeout \* 4?

This is because the session remains active as a redis key at "session:[connectionId]:active" for socket idle timeout \* 3. The length of time the cached data is kept is irrelevant so it's safer to ensure the active session has expired (through the use of redis key expiry) before processing the delayed job.

When the job is processed by the session service, the following happens...

1. Check if active session exists as a value at session:connectionId:active (ie. reconnected after disconnection)
2. If a session exists we can assume the socket reconnected following the disconnection - exit the process
3. If no active session found, clear cached rooms and subscriptions
4. Update DB with "disconnectedAt" timestamp (set to now() but maybe change to timestamp included with the job data)

The session is now ended. The connection is dead and all cached session data is now purged

### Remove from presence and broadcast disconnection

- **markSessionUserInactive -> SessionJobName.SESSION_USER_INACTIVE (5000ms delayed job)**

Responsible for informing presence subscribers that the connection has been lost and is now inactive. Subscribers will be notifed that the connection has left the room even thought the session has not been cleared. A reconnection will not add the connection back to presence set after this job has run. This will need to be handled manually.

Currently, 5000ms is the grace period awaiting socket reconnection. The 5000ms delayed job will be processd by the session service, executing...

- Remove active presence member from all presence sets it is active in (by cached room id) (Redis)
- Broadcast session destroy to interested presence subscriptions (RMQ)

### Record the disconnection event (PG)

- **recordConnnectionEvent -> SessionJobName.SESSION_SOCKET_CONNECTION_EVENT**

Job added to session queue for immediate processing. This is to maintain the session DB with accurate connection/disconnection data. The session service will execute...

- Update sessions table saving "updatedAt" timestamp using "connectionid" conflict to run the update
- Insert the disconnection event into connections table with corresponding connection event id (from the initial connection)
