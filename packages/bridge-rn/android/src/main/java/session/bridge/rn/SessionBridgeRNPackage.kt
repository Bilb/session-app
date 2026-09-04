package session.bridge.rn

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.session.bridge.rn.SessionBridgeRNOnLoad

/**
 * Empty of modules on purpose: everything here is a Nitro HybridObject, registered from C++ when
 * the library loads. What this class is for is autolinking, which looks for a ReactPackage to
 * decide a package is linkable — a pure-C++ module without one is skipped in silence, and shows
 * up much later as "SessionBridge does not exist".
 */
class SessionBridgeRNPackage : ReactPackage {
  init {
    SessionBridgeRNOnLoad.initializeNative()
  }

  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = emptyList()

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
