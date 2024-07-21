FROM node:20

COPY /build /src
COPY /package.json /src/package.json

ENV NODE_ENV=production

WORKDIR /src

RUN npm i
RUN npm install --verbose github:uNetworking/uWebSockets.js#v20.44.0

EXPOSE 4004
CMD ["node", "server.js"]