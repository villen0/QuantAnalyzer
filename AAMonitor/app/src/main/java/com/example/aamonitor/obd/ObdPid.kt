package com.example.aamonitor.obd

enum class ObdPid(
    val command: String,
    val minValue: Float,
    val maxValue: Float,
    val dataByteCount: Int
) {
    RPM("010C\r", 0f, 8000f, 2),
    SPEED("010D\r", 0f, 220f, 1),
    COOLANT_TEMP("0105\r", -40f, 215f, 1),
    THROTTLE("0111\r", 0f, 100f, 1);

    fun parse(bytes: List<Int>): Float = when (this) {
        RPM -> ((bytes[0] * 256) + bytes[1]) / 4f
        SPEED -> bytes[0].toFloat()
        COOLANT_TEMP -> (bytes[0] - 40).toFloat()
        THROTTLE -> (bytes[0] * 100f) / 255f
    }
}
