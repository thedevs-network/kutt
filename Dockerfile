FROM node:9.5.0-alpine

ADD . /code
WORKDIR /code
RUN apk add --no-cache bash
RUN npm install

CMD ["bash", "run.sh"]

