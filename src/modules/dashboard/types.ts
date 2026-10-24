export type TileAction = 'non-existing-customer' | 'joint-application'

export interface TileMenuItem {
  label: string
  /** Page to open; entries with an `action` open a dialog on the dashboard instead. */
  to?: string
  action?: TileAction
  /** Permission needed to see this entry. */
  permission?: string
}

export interface Tile {
  title: string
  subtitle: string
  icon?: string
  to: string
  footer: string
  footerTo?: string
  /** Permission needed to see the tile (none = everyone). */
  permission?: string
  menu?: TileMenuItem[]
  /** A count shown next to the title (the PROCESSES tile: processes pending or running); hidden at 0. */
  badge?: number
}
