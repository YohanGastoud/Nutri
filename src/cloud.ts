import { doc, getDoc, setDoc } from 'firebase/firestore'
import type { AppData } from './types'
import { db } from './firebase'
import { hasUserProgress, parseAppData, saveData } from './storage'

function userDoc(uid: string) {
  if (!db) throw new Error('Firestore n’est pas configuré.')
  return doc(db, 'users', uid)
}

export async function loadCloudData(uid: string): Promise<AppData | null> {
  const snap = await getDoc(userDoc(uid))
  if (!snap.exists()) return null
  const raw = snap.data()
  return parseAppData(raw?.data ?? raw)
}

export async function saveCloudData(uid: string, data: AppData): Promise<void> {
  await setDoc(
    userDoc(uid),
    {
      data,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

/**
 * Resolve cloud vs local on sign-in:
 * - cloud empty → upload local (migration)
 * - cloud present → prefer cloud, mirror to localStorage
 */
export async function resolveCloudData(
  uid: string,
  local: AppData,
): Promise<AppData> {
  const cloud = await loadCloudData(uid)
  if (!cloud) {
    if (hasUserProgress(local)) {
      await saveCloudData(uid, local)
    }
    return local
  }
  saveData(cloud)
  return cloud
}
