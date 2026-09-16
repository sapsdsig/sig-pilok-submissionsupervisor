import { useEffect, useId, useMemo, useState } from 'react'

export type SearchableOption = { value: string; label: string }

type Props = {
  value: string
  options: readonly SearchableOption[]
  placeholder: string
  emptyMessage: string
  loading?: boolean
  disabled?: boolean
  invalid?: boolean
  onChange: (value: string) => void
  onBlur?: () => void
}

export function SearchableSelect(props: Props) {
  const listId = useId()
  const [query, setQuery] = useState(props.value)
  useEffect(() => setQuery(props.value), [props.value])
  const exact = useMemo(
    () =>
      props.options.find(
        (option) =>
          option.label.toUpperCase() === query.trim().toUpperCase(),
      ),
    [props.options, query],
  )
  const noResult =
    query.trim().length > 0 &&
    !props.options.some((option) =>
      option.label.toUpperCase().includes(query.trim().toUpperCase()),
    )
  return (
    <div>
      <input
        type='text'
        role='combobox'
        list={listId}
        autoComplete='off'
        aria-autocomplete='list'
        aria-invalid={props.invalid}
        title={noResult ? props.emptyMessage : undefined}
        className={`text-input ${props.invalid ? 'input-error' : ''}`}
        disabled={props.disabled}
        placeholder={props.loading ? 'Memuat data...' : props.placeholder}
        value={query}
        onBlur={() => {
          if (exact) {
            setQuery(exact.label)
            props.onChange(exact.value)
          } else if (query !== props.value) {
            setQuery(props.value)
          }
          props.onBlur?.()
        }}
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          const selected = props.options.find(
            (option) => option.label === next,
          )
          props.onChange(selected?.value ?? '')
        }}
      />
      <datalist id={listId}>
        {props.options.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
      {noResult && (
        <p className='mt-1.5 text-xs text-slate-500'>{props.emptyMessage}</p>
      )}
    </div>
  )
}
