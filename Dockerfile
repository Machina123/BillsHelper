# Stage 1: build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY utilities/plewibnra/plewibnra.json ./public/plewibnra.json
RUN npm run build

# Stage 2: backend + serve frontend
FROM python:3.14-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /frontend/dist ./frontend/dist
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && mkdir -p /app/data \
    && useradd -r -u 1001 -g root appuser \
    && chown -R appuser /app /entrypoint.sh
USER appuser
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
