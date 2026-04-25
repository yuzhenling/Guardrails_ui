FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite variables are injected at build time.
# You can pass them with --build-arg when running docker build.
ARG CHAT_API_URL
ARG CHAT_GUARDRAILS_CONFIG_ID
ARG CHAT_MODEL
ARG VITE_CHAT_API_URL
ARG VITE_GUARDRAILS_CONFIG_ID
ARG VITE_CHAT_MODEL

ENV CHAT_API_URL=${CHAT_API_URL}
ENV CHAT_GUARDRAILS_CONFIG_ID=${CHAT_GUARDRAILS_CONFIG_ID}
ENV CHAT_MODEL=${CHAT_MODEL}
ENV VITE_CHAT_API_URL=${VITE_CHAT_API_URL}
ENV VITE_GUARDRAILS_CONFIG_ID=${VITE_GUARDRAILS_CONFIG_ID}
ENV VITE_CHAT_MODEL=${VITE_CHAT_MODEL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
