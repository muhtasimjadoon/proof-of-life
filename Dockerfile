# Proof of Life — zero dependency Node app, so no install step.
FROM node:20-alpine
WORKDIR /app
COPY . .
ENV POL_PORT=4855
# inside a container the server must listen beyond loopback (default is 127.0.0.1)
ENV POL_HOST=0.0.0.0
# persist creatures across restarts by mounting a volume at /data
ENV POL_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 4855
CMD ["node", "server.js"]
