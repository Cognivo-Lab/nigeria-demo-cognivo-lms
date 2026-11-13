# forge chassis — Node server. The app MUST read process.env.PORT and bind 0.0.0.0.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund --omit=dev || npm install --no-audit --no-fund --omit=dev || npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN npm run build --if-present
# APP_PROFILE=demo ships a seeded, evaluate-anywhere image (persona switch + demo
# logins). Override APP_PROFILE=production for an empty, first-run install.
ENV NODE_ENV=production PORT=8080 APP_PROFILE=demo
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=4s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1)))"
CMD ["sh","-c","npm start"]
