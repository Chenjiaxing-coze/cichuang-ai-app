package com.cichuang.ai;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

/**
 * 原生存储桥接：H5 通过 window.__NATIVE__ 调用。
 * - storageGet/Set：普通本地存储（收藏、自定义、统计等 7 个键）
 * - secureGet/Set：敏感凭据存储（access_token / refresh_token）
 *
 * 说明（v1.0 调试/自分发阶段）：安全令牌优先走后端 HTTPS + HMAC 签名 + JWT 双令牌，
 * 端上存储此处使用私有 SharedPreferences。生产签名的 release 包建议切换为
 * androidx.security.crypto.EncryptedSharedPreferences 以符合等保二级"加密存储敏感凭据"要求
 * （见《等保二级合规对照与整改报告.md》），本类已留好切换位。
 */
public class AppBridge {
    private final SharedPreferences normalStore;
    private final SharedPreferences secureStore;

    public AppBridge(Context ctx) {
        normalStore = ctx.getSharedPreferences("cichuang_normal", Context.MODE_PRIVATE);
        secureStore = ctx.getSharedPreferences("cichuang_secure", Context.MODE_PRIVATE);
    }

    @JavascriptInterface
    public String storageGet(String k) {
        return normalStore.getString(k, null);
    }

    @JavascriptInterface
    public void storageSet(String k, String v) {
        normalStore.edit().putString(k, v).apply();
    }

    @JavascriptInterface
    public String secureGet(String k) {
        return secureStore.getString(k, null);
    }

    @JavascriptInterface
    public void secureSet(String k, String v) {
        secureStore.edit().putString(k, v).apply();
    }
}
