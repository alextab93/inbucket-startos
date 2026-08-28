const numberValue = (value) => {
  if (value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const compareValues = (left, right, key, direction) => {
  const leftValue = numberValue(left.dataset[key])
  const rightValue = numberValue(right.dataset[key])
  if (leftValue === null && rightValue === null) return 0
  if (leftValue === null) return 1
  if (rightValue === null) return -1
  return (leftValue - rightValue) * direction
}

const compareItems = (left, right, sort) => {
  const comparison =
    sort === 'oldest'
      ? compareValues(left, right, 'timestamp', 1)
      : sort === 'largest'
        ? compareValues(left, right, 'size', -1)
        : sort === 'smallest'
          ? compareValues(left, right, 'size', 1)
          : compareValues(left, right, 'timestamp', -1)
  return (
    comparison ||
    Number(left.dataset.renderOrder) - Number(right.dataset.renderOrder)
  )
}

const emptyText = (noun, query, filtered) => {
  if (query && filtered) return `No ${noun} match your search and filters.`
  if (query) return `No ${noun} match your search.`
  return `No ${noun} match the selected filters.`
}

export const createListControls = ({
  control,
  trigger,
  panel,
  search,
  readFilter,
  unreadFilter,
  sortInputs,
  container,
  itemSelector,
  emptyClass,
  noun,
}) => {
  const close = () => {
    panel.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
  }

  const open = () => {
    for (const otherTrigger of document.querySelectorAll(
      '.list-filter-trigger[aria-expanded="true"]',
    )) {
      if (otherTrigger === trigger) continue
      otherTrigger.setAttribute('aria-expanded', 'false')
      document.getElementById(
        otherTrigger.getAttribute('aria-controls'),
      ).hidden = true
    }
    panel.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
  }

  const currentReadFilter = () => {
    if (readFilter.checked) return 'read'
    if (unreadFilter.checked) return 'unread'
    return 'all'
  }

  const currentSort = () =>
    [...sortInputs].find((input) => input.checked)?.value || 'newest'

  const apply = () => {
    const query = search.value.trim().toLocaleLowerCase()
    const readState = currentReadFilter()
    const filtered = readState !== 'all'
    const items = [...container.querySelectorAll(itemSelector)].sort(
      (left, right) => compareItems(left, right, currentSort()),
    )
    container.querySelector(`.${emptyClass}`)?.remove()
    let visible = 0

    for (const item of items) {
      container.append(item)
      const matchesSearch = item.dataset.searchText.includes(query)
      const matchesRead =
        readState === 'all' ||
        item.dataset.read === String(readState === 'read')
      item.hidden = !matchesSearch || !matchesRead
      if (!item.hidden) visible += 1
    }

    trigger.dataset.active = String(filtered || currentSort() !== 'newest')

    if (items.length && visible === 0) {
      container.append(
        Object.assign(document.createElement('p'), {
          className: `${emptyClass.includes('monitor') ? 'monitor-message-empty' : 'message-list-empty'} ${emptyClass}`,
          textContent: emptyText(noun, query, filtered),
        }),
      )
    }
  }

  trigger.addEventListener('click', () => {
    if (panel.hidden) open()
    else close()
  })
  control.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden) return
    close()
    trigger.focus()
  })
  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !control.contains(event.target)) close()
  })
  search.addEventListener('input', apply)
  readFilter.addEventListener('change', () => {
    if (readFilter.checked) unreadFilter.checked = false
    apply()
  })
  unreadFilter.addEventListener('change', () => {
    if (unreadFilter.checked) readFilter.checked = false
    apply()
  })
  for (const input of sortInputs) input.addEventListener('change', apply)

  return { apply, close }
}
