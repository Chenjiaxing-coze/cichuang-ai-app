package com.cichuang.ai;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import android.webkit.JavascriptInterface;
import java.io.IOException;
import java.security.GeneralSecurityException;

/**
 * 原生存储桥接：H5 通过 window.__NATIVE__ 调用。
 * - storageGet/Set：普通本地存储（收藏、自定义、统计等 7 个键）
 * - secureGet/Set：加密存储（access_token / refresh_token），使用 EncryptedSharedPreferences
 */
public class AppBridge {
    private final SharedPreferences normalStore;
    private final SharedPreferences secureStore;

    public AppBridge(Context ctx) {
        normalStore = ctx.getSharedPreferences("cichuang_normal", Context.MODE_PRIVATE);
        SharedPreferences sec = null;
        try {
            MasterKey mk = new MasterKey.Builder(ctx)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build();
            sec = EncryptedSharedPreferences.create(ctx,
                    "cichuang_secure",
                    mk,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
        } catch (GeneralSecurityException | IOException e) {
            e.printStackTrace();
        }
        secureStore = sec != null ? sec : ctx.getSharedPreferences("cichuang_secure_fallback", Context.MODE_PRIVATE);
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
