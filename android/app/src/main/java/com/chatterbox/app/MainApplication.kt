package com.chatterbox.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> {
          val packages = PackageList(this).packages.toMutableList()
          packages.add(ScreenshotGuardPackage())
          packages.add(KeyBackupPackage())
          return packages
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    ensureFeatureFlagsDontRequireNativeLib()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
  }

  private fun ensureFeatureFlagsDontRequireNativeLib() {
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) return
    try {
      val flagsClass =
        Class.forName("com.facebook.react.internal.featureflags.ReactNativeFeatureFlags")
      val localAccessorClass =
        Class.forName("com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsLocalAccessor")
      val localAccessor = localAccessorClass.getDeclaredConstructor().newInstance()

      val accessorField = flagsClass.getDeclaredField("accessor")
      accessorField.isAccessible = true
      accessorField.set(null, localAccessor)

      val accessorProviderField = flagsClass.getDeclaredField("accessorProvider")
      accessorProviderField.isAccessible = true
      val provider = object : kotlin.jvm.functions.Function0<Any?> {
        override fun invoke(): Any? = localAccessor
      }
      accessorProviderField.set(null, provider)
    } catch (_: Throwable) {
      // If this fails, React Native will fall back to the C++ accessor and crash on missing libs.
    }
  }
}
