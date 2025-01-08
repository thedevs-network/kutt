# specify node.js image
FROM node:22-alpine

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

# expose the port that the app listens on
EXPOSE 3000

# intialize database and run the app
CMD npm run migrate && npm start