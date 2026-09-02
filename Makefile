ARCHES := x86 arm
CLIENT_BUILD_INPUTS := Dockerfile Gemfile Gemfile.lock Rakefile config.ru package.json package-lock.json vite.config.mjs $(shell find app config db lib -type f 2>/dev/null) $(shell find frontend -type f ! -path 'frontend/node_modules/*' 2>/dev/null)
# overrides to s9pk.mk must precede the include statement
include node_modules/@start9labs/start-sdk/s9pk.mk

$(BASE_NAME).s9pk: $(CLIENT_BUILD_INPUTS)
$(BASE_NAME)_x86_64.s9pk: $(CLIENT_BUILD_INPUTS)
$(BASE_NAME)_aarch64.s9pk: $(CLIENT_BUILD_INPUTS)
