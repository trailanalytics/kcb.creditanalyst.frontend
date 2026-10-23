/** Wording of the Laravel error views (resources/views/errors/*.blade.php). */
export interface ErrorInfo {
  code: string
  title: string
  message: string
}

export const ERRORS: Record<string, ErrorInfo> = {
  '401': {
    code: '401',
    title: 'Please log in',
    message: 'Your session has expired or you are not logged in. Log in to continue.',
  },
  '403': {
    code: '403',
    title: "You don't have access to this page",
    message:
      'Your account does not have permission for this action. If you need it, ask your administrator to grant it.',
  },
  '404': {
    code: '404',
    title: 'Page not found',
    message:
      "The page you are looking for doesn't exist or has been moved. Check the address, or go back and try again.",
  },
  '419': {
    code: '419',
    title: 'Page expired',
    message:
      'This page was open for too long, so your request could not be completed. Refresh the page and try again. If your session has also expired, you will be asked to log in.',
  },
  '429': {
    code: '429',
    title: 'Too many requests',
    message: 'You have made too many requests in a short time. Please wait a minute and try again.',
  },
  '500': {
    code: '500',
    title: 'Something went wrong',
    message:
      "Sorry, it's us, not you. An unexpected error stopped this request. You can let IT know and they'll look into it.",
  },
  '503': {
    code: '503',
    title: 'Down for maintenance',
    message: 'Credit Analyst is being updated and will be back shortly. Please try again in a few minutes.',
  },
}

export const FALLBACK: ErrorInfo = {
  code: 'Error',
  title: 'Something went wrong',
  message: 'The request could not be completed. Please try again.',
}
