# specify node.js image
FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81

# use production node environment by default
ENV NODE_ENV=production

# set working directory.
WORKDIR /kutt

# download dependencies while using Docker's caching
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    apk upgrade --no-cache && \
    apk add --no-cache --virtual .build-deps python3 make g++ && \
    npm ci --omit=dev && \
    apk del .build-deps && \
    apk add --no-cache ca-certificates-bundle libcrypto3 libssl3 ssl_client && \
    apk del apk-tools libapk zlib && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /opt/yarn-* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg /usr/local/bin/corepack

RUN mkdir -p /var/lib/kutt

# copy the rest of source files into the image
COPY . .

# Keep build-only package tooling out without removing TLS runtime support.
RUN node tests/image-hardening.cjs

# expose the port that the app listens on
EXPOSE 3000

# intialize database and run the app
CMD ["sh", "-c", "node node_modules/knex/bin/cli.js migrate:latest && exec node server/server.js --production"]
