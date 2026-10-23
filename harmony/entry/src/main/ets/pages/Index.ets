import { webview } from '@kit.ArkWeb';
import { NativeBridge } from '../bridge/NativeBridge';

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private bridge?: NativeBridge;

  aboutToAppear(): void {
    // 在组件上下文就绪后创建原生桥接
    this.bridge = new NativeBridge(getContext(this));
  }

  build() {
    Column() {
      if (this.bridge) {
        Web({ src: $rawfile('词创AI_app.html'), controller: this.controller })
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .fileAccess(true)
          .javaScriptProxy({
            object: this.bridge,
            name: '__NATIVE__',
            methodList: ['storageGet', 'storageSet', 'secureGet', 'secureSet'],
            controller: this.controller
          })
      } else {
        // 桥接未就绪时的占位（通常瞬间切换，不会长时间展示）
        Text('加载中…')
          .fontSize(16)
          .fontColor('#0EA5E9')
      }
    }
    .width('100%')
    .height('100%')
  }
}
