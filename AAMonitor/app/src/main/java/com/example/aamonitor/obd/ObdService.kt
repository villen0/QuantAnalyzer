package com.example.aamonitor.obd

import android.app.NotificationChannel
import android.app.NotificationManager
import android.bluetooth.BluetoothManager
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.example.aamonitor.MainApplication
import com.example.aamonitor.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.IOException
import java.util.UUID

class ObdService : LifecycleService() {

    companion object {
        private const val TAG = "ObdService"
        const val EXTRA_DEVICE_ADDRESS = "device_address"
        private const val CHANNEL_ID = "obd_channel"
        private const val NOTIFICATION_ID = 1
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    private val app get() = application as MainApplication
    private var pollingJob: Job? = null
    private var currentAddress: String? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundNotification()
        // Reconnect to previously used adapter on service restart
        val saved = getSharedPreferences(MainApplication.PREFS_NAME, MODE_PRIVATE)
            .getString(MainApplication.KEY_DEVICE_ADDRESS, null)
        if (saved != null) {
            currentAddress = saved
            startPolling(saved)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        val address = intent?.getStringExtra(EXTRA_DEVICE_ADDRESS)
        if (address != null && address != currentAddress) {
            currentAddress = address
            startPolling(address)
        }
        return START_STICKY
    }

    private fun startPolling(address: String) {
        pollingJob?.cancel()
        pollingJob = lifecycleScope.launch(Dispatchers.IO) {
            while (isActive) {
                var connection: ObdConnection? = null
                try {
                    app.updateObdData(ObdData(connectionState = ConnectionState.CONNECTING))

                    val btManager = getSystemService(BLUETOOTH_SERVICE) as BluetoothManager
                    val adapter = btManager.adapter
                    adapter.cancelDiscovery()   // must cancel before connect()

                    val device = adapter.getRemoteDevice(address)
                    val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                    socket.connect()

                    connection = ObdConnection(socket)
                    connection.initialize()

                    app.updateObdData(ObdData(connectionState = ConnectionState.CONNECTED))
                    Log.i(TAG, "Connected to ELM327 at $address")

                    while (isActive) {
                        try {
                            val rpm = connection.queryPid(ObdPid.RPM)
                            val speed = connection.queryPid(ObdPid.SPEED)
                            val temp = connection.queryPid(ObdPid.COOLANT_TEMP)
                            val throttle = connection.queryPid(ObdPid.THROTTLE)

                            app.updateObdData(
                                ObdData(
                                    rpm = rpm,
                                    speedKph = speed,
                                    coolantTempC = temp,
                                    throttlePct = throttle,
                                    connectionState = ConnectionState.CONNECTED
                                )
                            )
                            delay(300)
                        } catch (e: IOException) {
                            Log.w(TAG, "PID query failed: ${e.message}")
                            // Single PID failure — continue loop; socket errors propagate to outer catch
                            delay(100)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Connection error: ${e.message}")
                    connection?.close()
                    app.updateObdData(
                        ObdData(
                            connectionState = ConnectionState.ERROR,
                            errorMessage = e.message ?: "Connection failed"
                        )
                    )
                    delay(3000) // wait 3s before retry
                }
            }
        }
    }

    private fun startForegroundNotification() {
        val channel = NotificationChannel(CHANNEL_ID, getString(R.string.channel_name), NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.notification_text))
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }
}
