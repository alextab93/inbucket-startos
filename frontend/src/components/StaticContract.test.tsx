import { StrictMode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { messages } from '../test/fixtures'
import { MessageWorkspace } from './MessageWorkspace'

describe('typed authenticated workspace', () => {
  it('renders representative canonical data as visible message choices', () => {
    render(
      <StrictMode>
        <MessageWorkspace
          messages={messages}
          selected={null}
          loading={false}
          listEmptyMessage="This mailbox has no messages."
          inspectorEmptyMessage="Select a message to read it."
          onSelectMessage={vi.fn()}
          onUnauthorized={vi.fn()}
          onRead={vi.fn()}
          onDeleted={async () => {}}
        />
      </StrictMode>,
    )

    const list = screen.getByRole('region', { name: 'Messages' })
    expect(
      within(list).getByRole('button', { name: /Unread: August invoice/ }),
    ).toBeVisible()
    expect(
      within(list).getByRole('button', { name: /Read: Welcome aboard/ }),
    ).toBeVisible()
    expect(screen.getByText('Select a message to read it.')).toBeVisible()
  })
})
