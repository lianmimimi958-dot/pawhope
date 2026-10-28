package cn.pawhope.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat

class WalkService : Service() {
    private var manager: LocationManager? = null
    private val listener = object : LocationListener {
        override fun onLocationChanged(loc: Location) {
            if (!WalkSession.watching) return
            val acc = if (loc.hasAccuracy()) loc.accuracy.toInt() else 999
            if (acc > 100) return
            WalkSession.add(loc.latitude, loc.longitude, loc.time, acc)
        }
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
        @Deprecated("legacy")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val channelId = "pawhope.walk"
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(channelId, "遛弯记录", NotificationManager.IMPORTANCE_LOW)
        )
        val notice = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_paw)
            .setContentTitle("爪印日记")
            .setContentText("正在用手机定位记录遛弯")
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(7, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(7, notice)
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf()
            return START_NOT_STICKY
        }
        val mgr = getSystemService(LOCATION_SERVICE) as LocationManager
        manager = mgr
        val provider = when {
            mgr.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            mgr.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> {
                WalkSession.watching = false
                stopSelf()
                return START_NOT_STICKY
            }
        }
        WalkSession.watching = true
        mgr.requestLocationUpdates(provider, 3000L, 3f, listener, Looper.getMainLooper())
        return START_STICKY
    }

    override fun onDestroy() {
        manager?.removeUpdates(listener)
        WalkSession.watching = false
        super.onDestroy()
    }
}
