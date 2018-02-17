FROM node:9.5.0-alpine

ADD . /code
WORKDIR /code
RUN npm install
RUN npm run build
CMD ["npm", "start"]
