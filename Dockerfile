FROM keymetrics/pm2:latest-alpine

COPY . .

RUN npm install
RUN npm run build

EXPOSE 3000
CMD [ "npm", "run", "pm2-next" ]