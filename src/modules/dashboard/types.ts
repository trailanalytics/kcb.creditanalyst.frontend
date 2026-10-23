export interface TileMenuItem {
  label: string
  to: string
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
}
