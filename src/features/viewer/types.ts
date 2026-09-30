// Find state passed to every viewer; undefined query/index = find closed.
export interface FindProps {
  findQuery?: string
  findCaseSensitive?: boolean
  findMatchIndex?: number
}
