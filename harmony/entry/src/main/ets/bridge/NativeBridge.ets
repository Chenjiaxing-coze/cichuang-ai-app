import { JavaScriptInterface } from '@kit.ArkWeb';
import preferences from '@ohos.data.preferences';
import { common } from '@kit.AbilityKit';

/**
 * 原生存储桥接：H5 通过 window.__NATIVE__ 调用。
 * - storageGet/storageSet：普通本地存储（收藏、自定义、统计等 7 个键）
 * - secureGet/secureSet：加密存储（access_token / refresh_token）
 *
 * 说明（v1.0 基线）：
 *   这里 secure 与 normal 都使用 Preferences（应用沙箱，默认仅本应用可读）。
 *   生产环境如需更强的密钥保护，应将 secure 层迁移到 Asset Store Kit
 *   (@ohos.security.asset)，其提供硬件级加密存储（API 11+）。
 *   由于 H5 侧以「同步返回值」方式调用，本桥统一用 Preferences 的同步接口，
 *   保证与 Android 端 window.__NATIVE__ 接口签名一致。
 */
export class NativeBridge {
  private normalPref: preferences.Preferences;
  private securePref: preferences.Preferences;

  constructor(context: common.Context) {
    this.normalPref = preferences.getPreferencesSync(context, { name: 'cichuang_normal' });
    this.securePref = preferences.getPreferencesSync(context, { name: 'cichuang_secure' });
  }

  @JavaScriptInterface
  storageGet(key: string): string {
    return this.normalPref.getSync(key, '') as string;
  }

  @JavaScriptInterface
  storageSet(key: string, value: string): void {
    this.normalPref.putSync(key, value);
    this.normalPref.flushSync();
  }

  @JavaScriptInterface
  secureGet(key: string): string {
    return this.securePref.getSync(key, '') as string;
  }

  @JavaScriptInterface
  secureSet(key: string, value: string): void {
    this.securePref.putSync(key, value);
    this.securePref.flushSync();
  }
}
