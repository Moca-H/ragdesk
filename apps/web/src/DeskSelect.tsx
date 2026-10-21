import { Select } from '@mantine/core'

type DeskSelectProps = {
  value: string
  data: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
  tone?: 'dark' | 'light'
  label?: string
  'aria-label'?: string
  className?: string
}

export function DeskSelect({
  value,
  data,
  onChange,
  disabled,
  tone = 'light',
  label,
  'aria-label': ariaLabel,
  className,
}: DeskSelectProps) {
  return (
    <Select
      className={['desk-select', `desk-select--${tone}`, className]
        .filter(Boolean)
        .join(' ')}
      classNames={{
        root: 'desk-select__root',
        label: 'desk-select__label',
        input: 'desk-select__input',
        wrapper: 'desk-select__wrapper',
        dropdown: `desk-select__dropdown desk-select__dropdown--${tone}`,
        option: `desk-select__option desk-select__option--${tone}`,
        section: 'desk-select__section',
      }}
      label={label}
      aria-label={ariaLabel}
      data={data}
      value={value || null}
      onChange={(v) => {
        if (v != null) onChange(v)
      }}
      disabled={disabled || data.length === 0}
      allowDeselect={false}
      withCheckIcon
      checkIconPosition="right"
      size="md"
      comboboxProps={{
        withinPortal: true,
        transitionProps: { transition: 'pop', duration: 160 },
        shadow: 'md',
        offset: 6,
      }}
    />
  )
}
