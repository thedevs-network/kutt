# use older node version for build since arm/v8 threw error when node 20 was used
FROM node:18.19.1-alpine AS build_image

# install additional tools needed if on arm64 / armv7
RUN RUN apk add --update python3 make g++\
    && rm -rf /var/cache/apk/*


# use production node environment by default
ENV NODE_ENV=production

# set working directory.
WORKDIR /kutt

# download dependencies while using Docker's caching
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

RUN mkdir -p /var/lib/kutt

# copy the rest of source files into the image
COPY . .

# switch back to node 22 for running the app
FROM node:22-alpine

# set working directory.
WORKDIR /kutt

# copy built application from build phase
COPY --from=build_image /kutt ./

# expose the port that the app listens on
EXPOSE 3000

# intialize database and run the app
CMD npm run migrate && npm start