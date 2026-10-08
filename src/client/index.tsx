/** Browser half: xAI Grok account management inside dsh Settings. */

import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { XaiSettings } from './XaiSettings.tsx'
import type { XaiOAuthSettingsInjected } from './XaiSettings.tsx'
import { en, zh } from './locales.ts'
import type { XaiOAuthSettingsKey } from './locales.ts'

/** 0.2 dropped @deepseek-ai/dsh-client-runtime; keep the slots/locale shape. */
type XaiClientContext = {
  effect: (fn: () => unknown, label?: string) => void
  locale: {
    register: (namespace: string, messages: { zh: typeof zh; en: typeof en }) => unknown
    bind: (namespace: string) => unknown
  }
  slots: {
    inject: (name: string, factory: () => unknown) => void
    register: (
      options: {
        name: string
        id: string
        order: number
        label: () => string
        inject: () => XaiOAuthSettingsInjected
      },
      component: typeof XaiSettings,
    ) => unknown
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.xai-oauth': XaiOAuthSettingsKey
  }
}

export const name = 'dsh-xai-client'
export const inject = ['slots', 'locale']

export function apply(ctx: XaiClientContext): void {
  const namespace = 'settings.xai-oauth'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-xai-grok: settings copy')
  const t = ctx.locale.bind(namespace) as XaiOAuthSettingsInjected['t']
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'xai-oauth',
    order: 16,
    label: () => t('nav'),
    inject: (): XaiOAuthSettingsInjected => ({ t }),
  }, XaiSettings))
}
