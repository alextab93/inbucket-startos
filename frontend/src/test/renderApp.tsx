import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import type { RequestHandler } from 'msw'
import { App } from '../App'
import { server } from './server'

export const renderApp = (handlers: RequestHandler[], initialPath = '/') => {
  window.history.replaceState(null, '', initialPath)
  server.use(...handlers)
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
