import { smtpPrefill } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const inputSpec = sdk.InputSpec.of({
  smtp: sdk.inputSpecConstants.smtpInputSpec,
})

export const configureSmtp = sdk.Action.withInput(
  'configure-smtp',
  async () => ({
    name: i18n('Configure SMTP'),
    description: i18n('Configure outbound notification email delivery.'),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),
  inputSpec,
  async ({ effects }) => ({
    smtp: smtpPrefill(
      await storeJson.read((store) => store.smtp).const(effects),
    ),
  }),
  async ({ effects, input }) => storeJson.merge(effects, { smtp: input.smtp }),
)
