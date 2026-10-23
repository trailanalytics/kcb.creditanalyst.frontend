declare module 'izitoast' {
  interface IziToastSettings {
    title?: string
    message?: string
    position?: string
    timeout?: number | false
    [key: string]: unknown
  }
  const iziToast: {
    show(settings: IziToastSettings): void
    success(settings: IziToastSettings): void
    error(settings: IziToastSettings): void
    warning(settings: IziToastSettings): void
    info(settings: IziToastSettings): void
    settings(settings: IziToastSettings): void
  }
  export default iziToast
}
