import { utils } from '@start9labs/start-sdk'
import { ruleLuaFile, storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

const secret = (len: number) =>
  utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len })
const luaRevision = 'inbucket-event-v1'

export const seedClientSecrets = sdk.setupOnInit(async (effects, kind) => {
  const store = await storeJson.read((value) => value).once()
  const luaEventToken = store?.luaEventToken || secret(48)

  if (kind === 'install') {
    await storeJson.merge(effects, {
      databasePassword: secret(48),
      secretKeyBase: secret(128),
      luaEventToken,
    })
  } else if (!store?.luaEventToken) {
    await storeJson.merge(effects, { luaEventToken })
  }

  await ruleLuaFile.write(
    effects,
    `local http = require("http")
local json = require("json")

local event_token = "${luaEventToken}"

function inbucket.after.message_stored(message)
  assert(http.post("http://127.0.0.1:3000/v1/internal/rule-events", {
    headers = {
      ["Content-Type"] = "application/json",
      ["X-Inbucket-Event-Token"] = event_token,
    },
    body = json.encode({ mailbox = message.mailbox, id = message.id, revision = "${luaRevision}" }),
  }))
end
`,
  )
})
