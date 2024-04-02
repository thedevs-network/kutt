FROM node:18-alpine

RUN apk update && apk upgrade
RUN apk add --update --no-cache bash make python3 build-base linux-headers

# Setting working directory.
WORKDIR /usr/src/app

# Installing dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copying source files
COPY . .

# Give permission to run script
RUN chmod +x ./wait-for-it.sh

# Build files
RUN npm run build

EXPOSE 3000

# Running the app
CMD [ "npm", "start" ]
