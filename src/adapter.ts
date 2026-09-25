/** xAI subscription adapter assembled from public dsh-llm-pi-ai extension points. */

import { LlmError, resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { preferredXaiOAuthModelFrom } from './catalog.ts'
import {
  XAI_OAUTH_ROUTE,
  XAI_OAUTH_STREAM_IDLE_TIMEOUT_MS,
  XAI_PI_PROVIDER,
} from './ids.ts'
import type { XaiOAuthSession } from './session.ts'
import { xaiProvider } from '@earendil-works/pi-ai/providers/xai'

/** Prefer grok-4.6 when the current (live or installed) list has it. */
export function preferredXaiOAuthModel(
  models: readonly { id: string }[] = xaiProvider().getModels(),
): string {
  return preferredXaiOAuthModelFrom(models)
}

/**
 * Create the SuperGrok adapter without a dsh fork.
 * The public pi-ai adapter owns streaming, tools, reasoning, and compaction;
 * this plugin supplies a refreshable OAuth token and an account model list.
 */
export function createXaiOAuthAdapter(
  session: XaiOAuthSession,
  resolveAttachments: () => AttachmentStore | undefined,
): PiAiAdapter {
  return new PiAiAdapter({
    profiles: () => new Map<string, ResolvedPiAiProviderProfile>([[XAI_OAUTH_ROUTE, {
      provider: XAI_OAUTH_ROUTE,
      displayName: 'xAI Grok',
      streamIdleTimeoutMs: XAI_OAUTH_STREAM_IDLE_TIMEOUT_MS,
      retryPolicy: resolveRetryPolicy(undefined, 'dsh-xai-grok retryPolicy'),
      configuredMaxTokens: new Map(),
      // dsh 0.1.5 resolves every model through modelErrors.get. The 0.1.0
      // profile type this package typechecks against does not declare it.
      modelErrors: new Map(),
      // A hand-built profile skips the host resolver, so these must be set or an
      // image turn throws "maxPixels must be a positive integer".
      // xAI publishes one image limit: 20MiB per image, jpeg/png, no count cap,
      // and no pixel cap.
      // https://docs.x.ai/developers/model-capabilities/images/understanding
      // The pixel budget is only here because the harness requires a positive
      // integer. It is large so an image already under 20MiB is not downscaled.
      maxRequestImageBytes: 20 * 20 * 1024 * 1024,
      requestImagePixelBudget: Number.MAX_SAFE_INTEGER,
      requestImageMaxBytes: 20 * 1024 * 1024,
      piProvider: session.provider(),
    } as ResolvedPiAiProviderProfile]]),
    resolveApiKey: async () => {
      const auth = await session.models.getAuth(XAI_PI_PROVIDER)
      const apiKey = auth?.auth.apiKey
      if (apiKey === undefined || apiKey.length === 0) {
        throw new LlmError(
          'xAI Grok is not signed in. Open Settings → xAI Grok and sign in with SuperGrok or X Premium.',
          'MISSING_CREDENTIAL',
        )
      }
      return apiKey
    },
    resolveAttachments,
  })
}
