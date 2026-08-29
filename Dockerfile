FROM node:22.23.2-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public
COPY --chown=node:node views ./views
COPY --chown=node:node data ./data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3001)+'/', r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
