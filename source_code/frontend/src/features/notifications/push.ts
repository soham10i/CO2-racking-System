import { subscribePush, unsubscribePush } from './api'

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on'

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function registration() {
  return navigator.serviceWorker.getRegistration()
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await registration()
  if (!reg) return 'unsupported'
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off'
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Asks for permission (only from a click), subscribes this browser and registers it with the server. */
export async function enablePush(vapidPublicKey: string): Promise<PushState> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = await registration()
  if (!reg) return 'unsupported'
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }))
  try {
    await subscribePush(sub.toJSON())
  } catch (e) {
    await sub.unsubscribe()
    throw e
  }
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const sub = await (await registration())?.pushManager.getSubscription()
  if (sub) {
    // The server copy goes first; a failed browser unsubscribe is then harmless.
    await unsubscribePush(sub.endpoint)
    await sub.unsubscribe()
  }
  return 'off'
}
