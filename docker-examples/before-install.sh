#!/bin/bash
set -ev

DOCKER_COMPOSE_VERSION="1.21.2"

# Install docker-compose
rm /usr/local/bin/docker-compose
curl -L https://github.com/docker/compose/releases/download/$DOCKER_COMPOSE_VERSION/docker-compose-`uname -s`-`uname -m` > docker-compose
chmod +x docker-compose
mv docker-compose /usr/local/bin

# Copy config files
cp ./docker-examples/client-config.example.js ./client/config.js
cp ./docker-examples/server-config.example.js ./server/config.js
