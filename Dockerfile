FROM node:20-alpine

COPY /build /src
COPY /package.json /src/package.json

ENV NODE_ENV=production

WORKDIR /src
RUN npm i

EXPOSE 4004
CMD ["node", "server.js"]