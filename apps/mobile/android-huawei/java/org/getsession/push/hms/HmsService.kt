package org.getsession.push.hms

import com.huawei.hms.push.HmsMessageService
import com.huawei.hms.push.RemoteMessage
import org.getsession.push.PushMessages
import org.getsession.push.PushTokens

/** Huawei's deliveries, passed on without Huawei's types to the code every build shares. */
class HmsService : HmsMessageService() {
  override fun onNewToken(token: String?) {
    if (!token.isNullOrEmpty()) PushTokens.changed()
  }

  override fun onMessageReceived(message: RemoteMessage?) {
    val data = message?.dataOfMap ?: return
    PushMessages.received(applicationContext, data)
  }
}
