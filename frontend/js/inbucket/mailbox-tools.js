const mailboxTools = () => [...document.querySelectorAll('.mailbox-tool')]

const closeMailboxTools = (tools) => {
  for (const tool of tools) tool.open = false
}

export const configureMailboxTools = () => {
  const tools = mailboxTools()
  const handleToggle = (event) => {
    if (!event.currentTarget.open) return
    for (const tool of tools) if (tool !== event.currentTarget) tool.open = false
  }
  const handleClick = (event) => {
    if (event.target instanceof Element && event.target.closest('.mailbox-tool')) return
    closeMailboxTools(tools)
  }
  const handleKeydown = (event) => {
    if (event.key !== 'Escape') return
    const openTool = tools.find((tool) => tool.open)
    if (!openTool) return
    openTool.open = false
    openTool.querySelector('summary')?.focus()
  }
  for (const tool of tools) tool.addEventListener('toggle', handleToggle)
  document.addEventListener('click', handleClick)
  document.addEventListener('keydown', handleKeydown)
}
