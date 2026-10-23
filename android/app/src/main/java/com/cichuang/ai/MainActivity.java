package com.cichuang.ai;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);                 // 启用 localStorage
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); // 仅 https 后端
        ws.setUserAgentString(ws.getUserAgentString() + " CiChuangApp/1.0.0");

        // 注入原生桥接：H5 侧的 window.__NATIVE__ 来自这里
        webView.addJavascriptInterface(new AppBridge(this), "__NATIVE__");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // 离线时加载本地资源失败应忽略（H5 已做降级）
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        // 加载内置 H5 内核（assets/www/词创AI_app.html）
        webView.loadUrl("file:///android_asset/www/词创AI_app.html");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
