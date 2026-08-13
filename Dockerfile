FROM node:22-bookworm-slim AS frontend

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY frontend ./frontend
COPY vite.config.mjs ./
RUN npm run build:frontend

FROM ruby:3.4.5-slim-bookworm

WORKDIR /app

RUN apt-get update -qq && apt-get install --no-install-recommends -y \
      build-essential curl libpq-dev libyaml-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Gemfile Gemfile.lock ./
RUN bundle config set without "development test" && \
    bundle install && \
    rm -rf /usr/local/bundle/cache

COPY . .
COPY --from=frontend /build/public ./public
RUN chmod +x bin/rails bin/rake

ENV RAILS_ENV=production \
    RAILS_LOG_TO_STDOUT=true \
    RAILS_SERVE_STATIC_FILES=true \
    PORT=3000

EXPOSE 3000
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
