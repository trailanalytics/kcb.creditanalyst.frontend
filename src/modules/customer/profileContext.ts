import { inject, provide, type InjectionKey, type Ref } from 'vue'
import type { ProfileModel } from './types'

export interface ProfileContext {
  form: ProfileModel
  /** Fields outlined in red until they are changed. */
  invalid: Ref<string[]>
  /** Unique per rendered form (the joint screen shows several); used for element ids. */
  id: string
  /** The profile embedded in another form: no client number, branch or classification rows. */
  embedded: boolean
  set(name: string, value: string): void
}

const KEY: InjectionKey<ProfileContext> = Symbol('profile-form')

export const provideProfile = (ctx: ProfileContext) => provide(KEY, ctx)

export function useProfile(): ProfileContext {
  const ctx = inject(KEY)
  if (!ctx) throw new Error('Profile fields must be used inside <ProfileForm>.')
  return ctx
}
