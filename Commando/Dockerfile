FROM node:latest as build-deps
ENV NODE_ENV=production
WORKDIR /app
RUN rm -rf ./*
COPY package.json package-lock.json ./
RUN npm install --production
COPY . .
EXPOSE 3987 
CMD [ "node", "index.js" ]
