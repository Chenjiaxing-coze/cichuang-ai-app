# 保留 JS 桥接类（@JavascriptInterface 不能混淆）
-keepclassmembers class com.cichuang.ai.AppBridge {
    public *;
}
-keepattributes *Annotation*
