package com.example.aamonitor.obd

import android.bluetooth.BluetoothSocket
import android.util.Log
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

class ObdConnection(private val socket: BluetoothSocket) {

    private val tag = "ObdConnection"
    private val input: InputStream = socket.inputStream
    private val output: OutputStream = socket.outputStream

    fun initialize() {
        sendCommand("ATZ\r", timeoutMs = 2000)    // reset, chip reboots (~1s)
        sendCommand("ATE0\r")                      // echo off
        sendCommand("ATL0\r")                      // linefeeds off
        sendCommand("ATS0\r")                      // spaces off — critical for hex parsing
        sendCommand("ATSP0\r")                     // auto-select OBD protocol
        Log.i(tag, "ELM327 initialised")
    }

    fun queryPid(pid: ObdPid): Float {
        val response = sendCommand(pid.command)
        return parseResponse(response, pid)
    }

    fun sendCommand(command: String, timeoutMs: Long = 1000): String {
        output.write(command.toByteArray(Charsets.US_ASCII))
        output.flush()
        return readUntilPrompt(timeoutMs)
    }

    private fun readUntilPrompt(timeoutMs: Long): String {
        val buf = StringBuilder()
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            val available = input.available()
            if (available > 0) {
                val bytes = ByteArray(available)
                val read = input.read(bytes)
                for (i in 0 until read) {
                    val ch = bytes[i].toInt().toChar()
                    buf.append(ch)
                    if (ch == '>') return buf.toString()
                }
            } else {
                Thread.sleep(15)
            }
        }
        return buf.toString()
    }

    private fun parseResponse(raw: String, pid: ObdPid): Float {
        // Strip prompt, CR/LF, and any whitespace
        val cleaned = raw.replace(">", "").replace("\r", "").replace("\n", "").trim()

        if (cleaned.containsAny("NO DATA", "UNABLE", "ERROR", "?", "STOPPED")) {
            Log.w(tag, "Non-data response for ${pid.name}: $cleaned")
            throw IOException("No data for ${pid.name}: $cleaned")
        }

        // Response format (with ATS0): 41<PID_HEX><DATA_BYTES>
        // e.g. "410C0BB8" for RPM — strip first 4 hex chars (mode+PID echo)
        val dataHex = if (cleaned.length >= 4) cleaned.drop(4) else
            throw IOException("Response too short for ${pid.name}: $cleaned")

        return try {
            val bytes = dataHex.chunked(2).take(pid.dataByteCount).map { it.trim().toInt(16) }
            if (bytes.size < pid.dataByteCount)
                throw IOException("Not enough data bytes for ${pid.name}: $cleaned")
            pid.parse(bytes)
        } catch (e: NumberFormatException) {
            throw IOException("Hex parse failed for ${pid.name}: $cleaned", e)
        }
    }

    fun close() {
        try { socket.close() } catch (_: IOException) {}
    }

    private fun String.containsAny(vararg tokens: String) = tokens.any { this.contains(it, ignoreCase = true) }
}
