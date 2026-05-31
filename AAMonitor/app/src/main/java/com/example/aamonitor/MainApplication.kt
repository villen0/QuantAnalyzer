package com.example.aamonitor

import android.app.Application
import com.example.aamonitor.obd.ObdData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class MainApplication : Application() {

    private val _obdData = MutableStateFlow(ObdData())
    val obdData: StateFlow<ObdData> = _obdData.asStateFlow()

    fun updateObdData(data: ObdData) {
        _obdData.value = data
    }

    companion object {
        const val PREFS_NAME = "obd_prefs"
        const val KEY_DEVICE_ADDRESS = "device_address"
    }
}
