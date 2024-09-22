FROM node:20-alpine

ENV NODE_ENV=production

COPY /build /src
COPY /package.json /src/package.json

WORKDIR /src

RUN apk add --no-cache gcompat
RUN apk add --no-cache make g++ cmake python3 git
RUN npm i --verbose

EXPOSE 4004

CMD ["node", "server.js"]