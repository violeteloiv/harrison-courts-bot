FROM node:latest

# Create the directory!
RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot

# Copy and Install our bot
COPY package.json /usr/src/bot
RUN npm install

COPY . /usr/src/bot

RUN npm run build

CMD ["npm", "run", "dev"]