FROM node:20-alpine

# Install python3, pip, and ffmpeg
RUN apk add --no-cache python3 py3-pip ffmpeg ca-certificates curl

# Install latest yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application source code
COPY . .

# Create downloads directory
RUN mkdir -p downloads

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
