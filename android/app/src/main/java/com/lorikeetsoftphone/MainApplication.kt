package com.lorikeetsoftphone

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.twiliovoicereactnative.VoiceApplicationProxy

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // VoiceApplicationProxy must be initialized before the React bridge starts;
    // getDefaultReactHost bypasses VoiceReactNativeHost so we bootstrap manually.
    VoiceApplicationProxy(this).onCreate()
    loadReactNative(this)
  }
}
