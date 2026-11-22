package org.getsession.qrscanner

import android.Manifest
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android's QR scanner: a CameraX preview whose frames zxing-cpp decodes. See QrScannerView for why
// this exists rather than expo-camera.
class QrScannerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QrScanner")

    // The same answer expo-camera's permission hook gives: status, granted, canAskAgain.
    AsyncFunction("getPermissionAsync") { promise: Promise ->
      Permissions.getPermissionsWithPermissionsManager(
        appContext.permissions,
        promise,
        Manifest.permission.CAMERA,
      )
    }

    AsyncFunction("requestPermissionAsync") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(
        appContext.permissions,
        promise,
        Manifest.permission.CAMERA,
      )
    }

    View(QrScannerView::class) {
      Events("onScan")
      Prop("active") { view: QrScannerView, active: Boolean -> view.setActive(active) }
      OnViewDestroys { view: QrScannerView -> view.release() }
    }
  }
}
