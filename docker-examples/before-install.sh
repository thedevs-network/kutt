#!/bin/bash
set -ev

DOCKER_COMPOSE_VERSION="1.21.2"


# Install docker-compose

if [ -f /usr/local/bin/docker-compose ]; then
  rm /usr/local/bin/docker-compose -f
fi

ulr=https://github.com/docker/compose/releases/download/$DOCKER_COMPOSE_VERSION/docker-compose-`uname -s`-`uname -m`
echo $ulr

curl -L $ulr > docker-compose
chmod +x docker-compose
mv docker-compose /usr/local/bin

# Copy config files
cp ./docker-examples/client-config.example.js ./client/config.js
cp ./docker-examples/server-config.example.js ./server/config.js
