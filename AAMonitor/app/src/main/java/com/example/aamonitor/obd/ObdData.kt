package com.example.aamonitor.obd

data class ObdData(
    val rpm: Float = 0f,
    val speedKph: Float = 0f,
    val coolantTempC: Float = -40f,
    val throttlePct: Float = 0f,
    val connectionState: ConnectionState = ConnectionState.DISCONNECTED,
    val errorMessage: String? = null
)

enum class ConnectionState {
    DISCONNECTED, CONNECTING, CONNECTED, ERROR
}
