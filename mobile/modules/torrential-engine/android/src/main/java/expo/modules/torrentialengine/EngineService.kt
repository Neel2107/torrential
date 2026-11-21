package expo.modules.torrentialengine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import java.io.File

/**
 * Keeps the engine's process alive while the app is in the background, so downloads continue with
 * the screen off. Android requires a notification for that.
 */
class EngineService : Service() {
  override fun onCreate() {
    super.onCreate()
    val notification = notification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION, notification)
    }
    // Starting waits for the engine to answer, which is too long for the main thread.
    Thread({ Engine.start(home(this).path, Engine.PORT) }, "torrential-engine-start").start()
  }

  // Android does not bring the service back without the app: the app starts it when it opens.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY

  // Android 15 allows a data sync service six hours a day. The engine runs on in the app's process
  // while the app is open; only the promise to keep it alive in the background ends here.
  override fun onTimeout(startId: Int, fgsType: Int) {
    stopSelf()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun notification(): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL, "Engine", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Shown while the engine runs on this phone"
        }
      )
    }
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      android.app.PendingIntent.getActivity(this, 0, it, android.app.PendingIntent.FLAG_IMMUTABLE)
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    return builder
      .setContentTitle("torrential")
      .setContentText("Engine running on this phone")
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setOngoing(true)
      .setContentIntent(open)
      .build()
  }

  companion object {
    private const val CHANNEL = "engine"
    private const val NOTIFICATION = 47929

    /** The engine's folder inside the app's private storage. */
    fun home(context: Context): File = File(context.filesDir, "engine")

    fun start(context: Context) {
      val intent = Intent(context, EngineService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }
  }
}
