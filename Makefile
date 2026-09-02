ARCHES := x86 arm
CLIENT_BUILD_INPUTS := $(shell find client -type f ! -path 'client/node_modules/*' ! -path 'client/public/*' ! -path 'client/log/*' ! -path 'client/tmp/*' 2>/dev/null)
# overrides to s9pk.mk must precede the include statement
include node_modules/@start9labs/start-sdk/s9pk.mk

$(BASE_NAME).s9pk: $(CLIENT_BUILD_INPUTS)
$(BASE_NAME)_x86_64.s9pk: $(CLIENT_BUILD_INPUTS)
$(BASE_NAME)_aarch64.s9pk: $(CLIENT_BUILD_INPUTS)
