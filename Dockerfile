FROM node:8-slim

WORKDIR /usr/src/app

ADD . /usr/src/app

RUN cd /usr/src/app && \
    npm install


ENTRYPOINT ["/usr/local/bin/node", "server.js"]