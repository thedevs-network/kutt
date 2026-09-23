# Database and Redis TLS

TLS is opt-in and fails closed. Existing SQLite and private plaintext Redis
deployments are unchanged. Do not publish database/Redis ports to enable this
feature. TLS is transport protection, not a substitute for network restrictions,
strong credentials, database grants, backups or application authorization.

## Configuration

| Setting | Default | Meaning |
| --- | --- | --- |
| `DB_SSL` | `false` | Verified TLS for installed `pg` and `mysql2` drivers |
| `DB_SSL_CA` | Unset | Optional PEM CA bundle |
| `DB_SSL_CERT` / `DB_SSL_KEY` | Unset | Optional PEM client certificate chain and private key, together |
| `REDIS_SSL` | `false` | Verified TLS for cache, visit queues/workers and rate limiting |
| `REDIS_SSL_CA` | Unset | Optional PEM CA bundle |
| `REDIS_SSL_CERT` / `REDIS_SSL_KEY` | Unset | Optional PEM client certificate chain and private key, together |

Each material setting supports `_FILE`, for example
`DB_SSL_CA_FILE=/run/secrets/database_ca`. File values override inline values;
unreadable, empty or malformed configured files fail startup instead of falling
back to the inline value. Prefer private read-only secret mounts. Preserve PEM
newlines. Encrypted private keys requiring a passphrase are not supported.
Omit unused settings entirely; do not set certificate variables to empty strings.
TLS material with its TLS flag disabled is an error. Redis TLS also requires
`REDIS_ENABLED=true`. Errors identify a setting, not its value or file path.

Both transports require TLS 1.2 or later, trusted certificate chains and a
matching server identity. Verification cannot be disabled. Omitting a custom
CA preserves the runtime trust store; supplying a CA bundle replaces that set.
Use a bundle containing the required current and next CA during a planned
rotation. The client leaf certificate and private key must match.

### Database

Use a DNS `DB_HOST` that matches the server certificate. The installed drivers
upgrade preconnected sockets, and mysql2 overrides custom identity checkers;
IP literals and Unix-socket paths are rejected for TLS rather than claiming
unverified IP identity. `mysql`, `pg-native` and SQLite TLS are not supported.
Other driver configurations without TLS are not expanded by this feature.

For example, use `DB_CLIENT=pg`, `DB_SSL=true`, `DB_HOST=db.internal.example`,
the real port/database and a least-privilege database account. Configure the
server to require TLS, and client certificates when using mutual TLS. Migrations
and application/worker connections use one shared configuration. SQL connection
pool limits now apply at Knex's top level; SQLite deliberately retains one
connection to preserve its transaction behavior.

### Redis

Redis cache, limiter and Bull command/subscriber/blocking connections receive
the same TLS options from a shared factory. They do not share a blocking socket.
DNS names use SNI and hostname verification. IP literals use IP SAN verification
without sending IP SNI. Configure the Redis server to require TLS and disable
its plaintext listener if that is the intended policy. A TLS failure never
switches to plaintext, a different Redis instance or an in-memory rate limiter.

## Validation and Recovery

Test in an isolated environment first. Confirm actual application reads/writes,
migrations, queued visit consumption and rate limits; the generic HTTP health
endpoint alone is not evidence of a working TLS connection. Check expiry of
server/client certificates and retain the issuing CA chain and rotation procedure.
Restart the app and workers after changing certificate files; clients load
material at startup, not continuously.

Back up database state, original application secrets, configuration and private
TLS credentials together in encrypted storage. Restore trusted server identity
and valid certificates before admitting traffic. Prefer correcting trust/DNS
or reverting to the last valid certificate configuration. Do not turn off
verification or silently change to plaintext to hide a certificate outage.
Older images do not implement these TLS settings; an image-only downgrade is
not compatible with a newly TLS-required database/Redis deployment.

`tests/transport-tls.sh` runs disposable PostgreSQL 17, MySQL 8.4 and Redis 8
servers with freshly generated test certificates and no published ports or
production mounts. It verifies encryption, mutual TLS, wrong SAN/CA, expired
certificates, plaintext-only denial, migration/runtime parity and real Redis
cache/Bull/limiter behavior. Test credentials/certificates are generated at run
time, never committed or reused in production. This is targeted integration
coverage, not full SQL-engine feature parity or production certificate acceptance.
