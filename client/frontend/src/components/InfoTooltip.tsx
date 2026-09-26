export const InfoTooltip = ({
  label,
  children,
  placement = 'top',
}: {
  label: string
  children: string
  placement?: 'top' | 'bottom'
}) => {
  const id = `rule-help-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <span className={`info-tooltip info-tooltip-${placement}`}>
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        i
      </button>
      <span id={id} role="tooltip">
        {children}
      </span>
    </span>
  )
}
