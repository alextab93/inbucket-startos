import { sdk } from '../sdk'
import { configureDomain } from './configureDomain'
import { refreshPassword } from './refreshPassword'
import { showCredentials } from './showCredentials'

export const actions = sdk.Actions.of()
  .addAction(configureDomain)
  .addAction(showCredentials)
  .addAction(refreshPassword)
