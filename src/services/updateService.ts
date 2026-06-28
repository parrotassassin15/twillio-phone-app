import { Config } from '../config';

export type UpdateInfo = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseNotes?: string;
};

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const resp = await fetch(Config.UPDATE_CHECK_URL, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!resp.ok) return null;
    const data: UpdateInfo = await resp.json();
    if (typeof data.versionCode !== 'number' || !data.apkUrl) return null;
    if (data.versionCode <= Config.APP_VERSION_CODE) return null;
    return data;
  } catch {
    return null;
  }
}
