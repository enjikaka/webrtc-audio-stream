FROM node:12.10.0

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
COPY yarn.lock /usr/src/app/

RUN yarn

COPY . /usr/src/app

ENV NODE_ENV=production
CMD [ "yarn", "start" ]
EXPOSE 5000
