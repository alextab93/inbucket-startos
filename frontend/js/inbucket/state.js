export const state = {
  currentMailbox: '',
  currentMessageId: '',
  selectedMailboxes: new Set(),
}

export const selectedMailboxNames = () => [...state.selectedMailboxes]

export const replaceSelectedMailboxes = (mailboxes) => {
  state.selectedMailboxes = new Set(mailboxes)
}
