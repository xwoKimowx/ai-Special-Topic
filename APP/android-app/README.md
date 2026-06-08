# AI 題庫助教 Android App

這是「AI 智能題庫整理助教」的 Android 版本，使用 WebView 技術將網頁應用包裝成原生 Android APP。

## 專案結構

```
android-app/
├── app/
│   ├── src/main/
│   │   ├── assets/           # 網頁資源檔案
│   │   │   ├── index.html
│   │   │   ├── script.js
│   │   │   └── style.css
│   │   ├── java/.../         # Java 程式碼
│   │   │   └── MainActivity.java
│   │   ├── res/
│   │   │   ├── layout/       # 佈局檔案
│   │   │   ├── mipmap-*/     # App 圖示
│   │   │   └── values/       # 字串和樣式
│   │   └── AndroidManifest.xml
│   ├── build.gradle          # 模組設定
│   └── proguard-rules.pro
├── build.gradle              # 專案設定
├── settings.gradle
└── gradle.properties
```

## 編譯方式

### 方法一：使用 Android Studio (推薦)

1. 下載並安裝 [Android Studio](https://developer.android.com/studio)
2. 開啟 Android Studio，選擇 **Open an existing project**
3. 選擇 `android-app` 資料夾
4. 等待 Gradle 同步完成
5. 點擊 **Build > Build Bundle(s) / APK(s) > Build APK(s)**
6. APK 會生成在 `app/build/outputs/apk/debug/` 資料夾

### 方法二：使用命令列

確保已安裝 JDK 17 和 Android SDK。

```bash
# 進入專案目錄
cd android-app

# Linux/Mac
./gradlew assembleDebug

# Windows
gradlew.bat assembleDebug
```

APK 位置：`app/build/outputs/apk/debug/app-debug.apk`

## 安裝到手機

### Debug 版本 (測試用)

1. 在手機開啟 **開發人員選項**
2. 啟用 **USB 偵錯**
3. 使用 USB 連接手機到電腦
4. 在 Android Studio 點擊 **Run** 按鈕

### Release 版本 (正式發布)

1. 建立簽名金鑰：
   ```bash
   keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
   ```

2. 在 `app/build.gradle` 設定簽名配置

3. 編譯 Release APK：
   ```bash
   ./gradlew assembleRelease
   ```

## 功能特色

- 全螢幕沉浸式體驗
- 支援檔案選擇（上傳 TXT、DOCX、PDF）
- 支援本地儲存（localStorage）
- 網路 API 呼叫支援
- 返回鍵支援 WebView 歷史

## 系統需求

- Android 7.0 (API 24) 以上
- 建議 Android 10.0 以上以獲得最佳體驗

## 注意事項

1. API 金鑰：確保 `script.js` 中的 DeepSeek API 金鑰已正確設定
2. 網路連線：使用 AI 功能需要網路連線
3. 檔案存取：Android 10 以上可能需要額外權限設定

## 版本資訊

- App 版本：1.58
- Target SDK：34 (Android 14)
- Min SDK：24 (Android 7.0)
