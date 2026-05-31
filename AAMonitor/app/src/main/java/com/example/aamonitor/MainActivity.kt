package com.example.aamonitor

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.aamonitor.obd.ConnectionState
import com.example.aamonitor.obd.ObdService
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private val bluetoothAdapter by lazy {
        (getSystemService(BLUETOOTH_SERVICE) as BluetoothManager).adapter
    }

    private var pairedDevices: List<BluetoothDevice> = emptyList()

    private val requestPermissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) {
            populateDeviceList()
        } else {
            Toast.makeText(this, getString(R.string.perm_rationale), Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        checkAndRequestPermissions()
        observeStatus()
    }

    private fun checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val needed = listOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            ).filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }

            if (needed.isEmpty()) populateDeviceList()
            else requestPermissions.launch(needed.toTypedArray())
        } else {
            populateDeviceList()
        }
    }

    private fun populateDeviceList() {
        pairedDevices = bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()

        val listView = findViewById<ListView>(R.id.deviceList)

        if (pairedDevices.isEmpty()) {
            listView.adapter = ArrayAdapter(
                this,
                android.R.layout.simple_list_item_1,
                listOf(getString(R.string.no_devices))
            )
            return
        }

        val displayNames = pairedDevices.map { "${it.name}  (${it.address})" }
        listView.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, displayNames)

        listView.setOnItemClickListener { _, _, position, _ ->
            val device = pairedDevices[position]
            connectToDevice(device)
        }
    }

    private fun connectToDevice(device: BluetoothDevice) {
        // Save address for service restart persistence
        getSharedPreferences(MainApplication.PREFS_NAME, MODE_PRIVATE).edit()
            .putString(MainApplication.KEY_DEVICE_ADDRESS, device.address)
            .apply()

        Toast.makeText(this, "Connecting to ${device.name}…", Toast.LENGTH_SHORT).show()

        val intent = Intent(this, ObdService::class.java).apply {
            putExtra(ObdService.EXTRA_DEVICE_ADDRESS, device.address)
        }
        startForegroundService(intent)
    }

    private fun observeStatus() {
        val statusText = findViewById<TextView>(R.id.statusText)
        val app = application as MainApplication
        lifecycleScope.launch {
            app.obdData.collect { data ->
                statusText.text = when (data.connectionState) {
                    ConnectionState.DISCONNECTED -> getString(R.string.status_disconnected)
                    ConnectionState.CONNECTING -> getString(R.string.status_connecting)
                    ConnectionState.CONNECTED -> getString(R.string.status_connected)
                    ConnectionState.ERROR -> getString(R.string.status_error_prefix) + (data.errorMessage ?: "Unknown error")
                }
                statusText.setTextColor(
                    when (data.connectionState) {
                        ConnectionState.CONNECTED -> 0xFF34C759.toInt()
                        ConnectionState.ERROR -> 0xFFFF3B30.toInt()
                        else -> 0xFFFFCC00.toInt()
                    }
                )
            }
        }
    }
}
