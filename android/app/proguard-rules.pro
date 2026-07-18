# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ---- React Native & Hermes ----
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep React Native bridge methods
-keepclassmembers class * extends com.facebook.react.bridge.JavaScriptModule {
   *;
}

-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Keep TurboModules / Fabric classes
-keep class com.facebook.react.turbomodule.** { *; }
-keep,allowobfuscation @interface com.facebook.react.bridge.ReactMethod

# ---- Firebase ----
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ---- WebRTC (react-native-webrtc) ----
-keep class org.webrtc.** { *; }
-keepclasseswithmembernames class org.webrtc.** {
    native <methods>;
}
-dontwarn org.webrtc.**

# ---- MMKV (react-native-mmkv) ----
-keep class com.tencent.mmkv.** { *; }
-keepclasseswithmembernames class com.tencent.mmkv.** {
    native <methods>;
}

# ---- React Navigation (react-native-screens, gesture-handler) ----
-keep class com.swmansion.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }

# ---- react-native-gesture-handler ----
-keep class com.swmansion.gesturehandler.** { *; }

# ---- react-native-image-picker ----
-keep class com.imagepicker.** { *; }

# ---- react-native-video ----
-keep class com.brentvatne.react.** { *; }

# ---- react-native-audio-recorder-player ----
-keep class com.dooboolab.audiorecorderplayer.** { *; }

# ---- react-native-document-picker ----
-keep class com.reactnativedocumentpicker.** { *; }

# ---- react-native-incall-manager ----
-keep class com.zxcpoiu.incallmanager.** { *; }

# ---- OkHttp (used by various RN libraries) ----
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Don't warn about missing optional classes
-dontwarn com.facebook.react.**
-dontwarn com.google.**
-dontwarn javax.annotation.**
