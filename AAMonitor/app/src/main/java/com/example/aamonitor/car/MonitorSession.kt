package com.example.aamonitor.car

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session
import com.example.aamonitor.MainApplication
import com.example.aamonitor.obd.ObdService

class MonitorSession : Session() {

    override fun onCreateScreen(intent: Intent): Screen {
        val app = carContext.applicationContext as MainApplication

        // Ensure the OBD polling service is running (it auto-loads saved address)
        carContext.applicationContext.startForegroundService(
            Intent(carContext.applicationContext, ObdService::class.java)
        )

        return DashboardScreen(carContext, app.obdData)
    }
}
