/*
 * AeroTrace Node 1
 * Waveshare ESP32-S3 + A7670E 4G + Smart SIM
 *
 * Features:
 * - Wi-Fi AP at 192.168.4.1 with a local diagnostics dashboard.
 * - A7670E cellular registration, packet-data, internet, and GNSS checks.
 * - Serial diagnostics for modem, sensors, GPS, and Wi-Fi clients.
 * - Smart LTE APN: internet, PAP, IPv4.
 *
 * IMPORTANT HARDWARE PINOUT
 * -------------------------
 * A7670E modem UART:
 *   ESP32 GPIO18 (RX) <- A7670E TXD
 *   ESP32 GPIO17 (TX) -> A7670E RXD
 *   GPIO40             <- RI (ring indicator), optional
 *   GPIO45             -> DTR; HIGH keeps the modem awake
 *
 * SHT45:
 *   SDA -> GPIO8, SCL -> GPIO9, VCC -> 3V3, GND -> GND
 *
 * PH4052C:
 *   Analog PO -> GPIO10 (ADC)
 *
 * TDS conductivity module:
 *   Analog AOUT -> GPIO5 (ADC)
 *
 * GP2Y1010AU0F optical dust sensor:
 *   LED control -> GPIO7
 *   Analog VO   -> GPIO6 (ADC)
 *
 * Do not power analog outputs above the ESP32 ADC voltage range. Calibrate
 * pH, TDS, and dust values for the actual sensor modules before deployment.
 * The modem requires a stable supply capable of handling LTE transmit peaks.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <HardwareSerial.h>
#include <Wire.h>
#include <Adafruit_SHT4x.h>
#include <TinyGsmClient.h>
// A7670E is a SIMCom A76xx LTE modem. A7672X is the closest TinyGSM modem
// profile and is preferable to SIM7600 for command and PDP handling.
#define TINY_GSM_MODEM_A7672X
#define TINY_GSM_RX_BUFFER 2048
#include <HTTPClient.h>
// ---------------- User configuration ----------------
static const char AP_SSID[] = "AeroTrace-N1";
static const char AP_PASSWORD[] = "MercadoARN1!";
static const char MDNS_HOST[] = "aerotrace-n1";
static const char SMART_APN[] = "internet";
static const char VERCEL_TELEMETRY_URL[] = "https://YOUR-DOMAIN.vercel.app/api/telemetry";
static const char DEVICE_ID[] = "aerotrace-001";
static const char DEVICE_TOKEN[] = "REPLACE_WITH_DEVICE_TOKEN";
// ---------------- Corrected board pinout ----------------
static constexpr int MODEM_RX_PIN = 18;
static constexpr int MODEM_TX_PIN = 17;
static constexpr int MODEM_RI_PIN = 40;
static constexpr int MODEM_DTR_PIN = 45;
static constexpr uint32_t MODEM_BAUD = 115200;
static constexpr int SHT45_SDA_PIN = 8;
static constexpr int SHT45_SCL_PIN = 9;
static constexpr int PH_ANALOG_PIN = 10;
static constexpr int TDS_ANALOG_PIN = 5;
static constexpr int DUST_ANALOG_PIN = 6;
static constexpr int DUST_LED_PIN = 7;
static constexpr uint16_t DNS_PORT = 53;
static constexpr uint32_t MODEM_POLL_MS = 15000;
static constexpr uint32_t GPS_POLL_MS = 5000;
static constexpr uint32_t TELEMETRY_MS = 60000;
static constexpr uint32_t SERIAL_REPORT_MS = 10000;
HardwareSerial SerialAT(1);
TinyGsm modem(SerialAT);
TinyGsmClient cellularClient(modem);
WebServer server(80);
DNSServer dnsServer;
Adafruit_SHT4x sht4;
struct DeviceState {
  bool modem = false, simReady = false, registered = false;
  bool packetAttached = false, dataConnected = false, internetOK = false;
  bool gnssEnabled = false, gpsFix = false, shtReady = false;
  int csq = -1, rssiDbm = -999, clients = 0;
  String sim = "UNKNOWN", operatorName = "UNKNOWN", registration = "UNKNOWN";
  String imei = "UNKNOWN", lastError = "";
  double lat = 0, lon = 0, altitude = 0;
  double temperatureC = NAN, humidityPct = NAN;
  double ph = NAN, tdsPpm = NAN, dustUgM3 = NAN;
  String gpsDate, gpsTime;
} state;
uint32_t lastModemPoll = 0, lastGpsPoll = 0, lastTelemetry = 0, lastReport = 0;
bool modemBusy = false;
String atCommand(const char *command, uint32_t timeoutMs = 1800) {
  while (SerialAT.available()) SerialAT.read();
  SerialAT.print(command); SerialAT.print("\r\n");
  String output; output.reserve(512);
  uint32_t started = millis();
  while (millis() - started < timeoutMs) {
    while (SerialAT.available()) {
      char c = (char)SerialAT.read();
      if (output.length() < 1800) output += c;
    }
    if (output.indexOf("\nOK") >= 0 || output.indexOf("\nERROR") >= 0) break;
    delay(1);
  }
  output.trim();
  return output;
}
bool commandOK(const String &response) {
  return response.indexOf("OK") >= 0 && response.indexOf("ERROR") < 0;
}
bool registrationOK(const String &response) {
  int colon = response.indexOf(':');
  if (colon < 0) return false;
  String value = response.substring(colon + 1); value.trim();
  int comma = value.indexOf(',');
  int status = comma >= 0 ? value.substring(comma + 1).toInt() : value.toInt();
  return status == 1 || status == 5;
}
String quotedValue(const String &response) {
  int first = response.indexOf('"');
  int second = response.indexOf('"', first + 1);
  return first >= 0 && second > first ? response.substring(first + 1, second) : "UNKNOWN";
}
void pollModem() {
  if (modemBusy) return;
  modemBusy = true;
  String response = atCommand("AT", 1200);
  state.modem = commandOK(response);
  if (!state.modem) {
    state.lastError = "No A7670E AT response: verify power, UART pins, DTR, and baud";
    modemBusy = false; return;
  }
  response = atCommand("AT+CPIN?", 1800);
  state.simReady = response.indexOf("READY") >= 0;
  state.sim = state.simReady ? "READY" : "NOT READY";
  String eps = atCommand("AT+CEREG?", 1800);
  String gsm = atCommand("AT+CREG?", 1800);
  state.registered = registrationOK(eps) || registrationOK(gsm);
  state.registration = state.registered ? "REGISTERED" :
    (eps.indexOf(",2") >= 0 || gsm.indexOf(",2") >= 0 ? "SEARCHING" : "NOT REGISTERED");
  response = atCommand("AT+CGATT?", 1800);
  state.packetAttached = response.indexOf("+CGATT: 1") >= 0;
  response = atCommand("AT+CSQ", 1800);
  int csqStart = response.indexOf("+CSQ:");
  state.csq = -1; state.rssiDbm = -999;
  if (csqStart >= 0) {
    int value = response.substring(csqStart + 5).toInt();
    if (value >= 0 && value <= 31) { state.csq = value; state.rssiDbm = -113 + 2 * value; }
  }
  response = atCommand("AT+COPS?", 2500);
  String operatorName = quotedValue(response);
  if (operatorName != "UNKNOWN") state.operatorName = operatorName;
  response = atCommand("AT+CGSN", 1800);
  int lineStart = 0;
  while (lineStart < (int)response.length()) {
    int lineEnd = response.indexOf('\n', lineStart); if (lineEnd < 0) lineEnd = response.length();
    String line = response.substring(lineStart, lineEnd); line.trim();
    bool valid = line.length() == 15;
    for (size_t i = 0; i < line.length() && valid; i++) valid = isDigit(line[i]);
    if (valid) { state.imei = line; break; }
    lineStart = lineEnd + 1;
  }
  modemBusy = false;
}
bool enableGNSS() {
  if (modemBusy) return false;
  modemBusy = true;
  bool ok = commandOK(atCommand("AT+CGNSSPWR=1", 5000));
  state.gnssEnabled = ok;
  modemBusy = false;
  return ok;
}
bool readGNSS() {
  if (modemBusy || !state.gnssEnabled) return false;
  modemBusy = true;
  String response = atCommand("AT+CGPSINFO", 3000);
  modemBusy = false;
  int start = response.indexOf("+CGPSINFO:");
  if (start < 0) { state.gpsFix = false; return false; }
  String payload = response.substring(start + 10); payload.trim();
  String fields[9]; int count = 0, from = 0;
  while (count < 9) {
    int comma = payload.indexOf(',', from);
    if (comma < 0) { fields[count++] = payload.substring(from); break; }
    fields[count++] = payload.substring(from, comma); from = comma + 1;
  }
  if (count < 7 || fields[0].isEmpty() || fields[2].isEmpty()) { state.gpsFix = false; return false; }
  double rawLat = fields[0].toDouble(), rawLon = fields[2].toDouble();
  int latDeg = (int)(rawLat / 100.0), lonDeg = (int)(rawLon / 100.0);
  state.lat = latDeg + (rawLat - latDeg * 100.0) / 60.0;
  state.lon = lonDeg + (rawLon - lonDeg * 100.0) / 60.0;
  if (fields[1] == "S") state.lat = -state.lat;
  if (fields[3] == "W") state.lon = -state.lon;
  state.altitude = fields[6].toDouble(); state.gpsDate = fields[4]; state.gpsTime = fields[5];
  state.gpsFix = fabs(state.lat) <= 90 && fabs(state.lon) <= 180;
  return state.gpsFix;
}
void readSensors() {
  if (state.shtReady) {
    sensors_event_t humidity, temperature;
    if (sht4.getEvent(&humidity, &temperature)) {
      state.temperatureC = temperature.temperature;
      state.humidityPct = humidity.relative_humidity;
    }
  }
  int phRaw = analogRead(PH_ANALOG_PIN);
  int tdsRaw = analogRead(TDS_ANALOG_PIN);
  digitalWrite(DUST_LED_PIN, LOW); delayMicroseconds(280);
  int dustRaw = analogRead(DUST_ANALOG_PIN);
  delayMicroseconds(40); digitalWrite(DUST_LED_PIN, HIGH); delayMicroseconds(9680);
  state.ph = (phRaw / 4095.0) * 3.3 * 3.5;
  state.tdsPpm = (tdsRaw / 4095.0) * 1000.0;
  state.dustUgM3 = max(0.0, ((dustRaw / 4095.0) * 3.3 - 0.6) * 1000.0 / 0.5);
}
bool connectCellular() {
  if (!state.modem || !state.simReady || !state.registered) return false;
  modemBusy = true;
  Serial.println("[NET] Attaching Smart LTE PDP context...");
  bool connected = modem.isGprsConnected();
  if (!connected) connected = modem.gprsConnect(SMART_APN, "", "");
  state.dataConnected = connected;
  if (!connected) { state.internetOK = false; state.lastError = "PDP failed: check APN internet, registration, signal, and Smart data service"; modemBusy = false; return false; }
  Serial.print("[NET] PDP IP: "); Serial.println(modem.localIP());
  cellularClient.stop(); bool ok = cellularClient.connect("example.com", 80);
  if (ok) {
    cellularClient.print("GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n");
    uint32_t started = millis(); while (millis() - started < 8000 && !cellularClient.available()) delay(10);
    String status = cellularClient.readStringUntil('\n'); Serial.print("[NET] HTTP: "); Serial.println(status);
    ok = status.startsWith("HTTP/1.");
  }
  cellularClient.stop(); state.internetOK = ok;
  if (!ok) state.lastError = "PDP connected but internet HTTP test failed"; else state.lastError = "";
  modemBusy = false; return ok;
}
String jsonEscape(const String &value) { String out; for (char c : value) { if (c == '"' || c == '\\') out += '\\'; if (c == '\n') out += "\\n"; else out += c; } return out; }
String numberOrNull(double value, int digits = 2) { return isnan(value) ? "null" : String(value, digits); }
String telemetryJson() {
  String json = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"sequence\":" + String(millis()) + ",\"location\":{";
  json += "\"lat\":" + (state.gpsFix ? String(state.lat, 6) : "null") + ",\"lng\":" + (state.gpsFix ? String(state.lon, 6) : "null") + "},";
  json += "\"ph\":" + numberOrNull(state.ph, 3) + ",\"tdsPpm\":" + numberOrNull(state.tdsPpm) + ",\"pm25UgM3\":" + numberOrNull(state.dustUgM3) + ",\"temperatureC\":" + numberOrNull(state.temperatureC) + ",\"humidityPct\":" + numberOrNull(state.humidityPct) + ",\"signalDbm\":" + String(state.rssiDbm) + "}";
  return json;
}
void sendTelemetry() {
  if (!state.dataConnected || String(VERCEL_TELEMETRY_URL).indexOf("YOUR-DOMAIN") >= 0) return;
  modemBusy = true;
  HTTPClient http; TinyGsmClientSecure secureClient(modem);
  if (!http.begin(secureClient, VERCEL_TELEMETRY_URL)) { modemBusy = false; return; }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(DEVICE_TOKEN));
  int code = http.POST(telemetryJson());
  Serial.printf("[API] Telemetry HTTP status: %d\n", code);
  http.end(); modemBusy = false;
}
void handleStatus() {
  state.clients = WiFi.softAPgetStationNum();
  String json = "{\"modem\":" + String(state.modem ? "true" : "false") + ",\"sim\":\"" + state.sim + "\",\"registration\":\"" + state.registration + "\",\"operator\":\"" + jsonEscape(state.operatorName) + "\",\"csq\":" + String(state.csq) + ",\"rssiDbm\":" + String(state.rssiDbm) + ",\"packetAttached\":" + String(state.packetAttached ? "true" : "false") + ",\"dataConnected\":" + String(state.dataConnected ? "true" : "false") + ",\"internet\":" + String(state.internetOK ? "true" : "false") + ",\"clients\":" + String(state.clients) + ",\"imei\":\"" + state.imei + "\",\"uptime\":" + String(millis() / 1000) + ",\"error\":\"" + jsonEscape(state.lastError) + "\"}";
  server.sendHeader("Cache-Control", "no-store"); server.send(200, "application/json", json);
}
void handleGPS() {
  String json = "{\"fix\":" + String(state.gpsFix ? "true" : "false") + ",\"latitude\":" + (state.gpsFix ? String(state.lat, 6) : "null") + ",\"longitude\":" + (state.gpsFix ? String(state.lon, 6) : "null") + ",\"altitude\":" + (state.gpsFix ? String(state.altitude, 2) : "null") + "}";
  server.sendHeader("Cache-Control", "no-store"); server.send(200, "application/json", json);
}
void setupWeb() {
  server.on("/", HTTP_GET, []() { server.send(200, "text/plain", "AeroTrace Node online. Use /api/status and /api/gps."); });
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/gps", HTTP_GET, handleGPS);
  server.on("/api/gps/refresh", HTTP_GET, []() { server.send(readGNSS() ? 200 : 503, "application/json", readGNSS() ? "{\"ok\":true}" : "{\"ok\":false}"); });
  server.on("/api/health", HTTP_GET, []() { server.send(200, "application/json", "{\"ok\":true,\"device\":\"AeroTrace Node 1\"}"); });
  server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
  server.begin();
}
void startAP() {
  WiFi.mode(WIFI_AP); WiFi.setSleep(false);
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  bool started = WiFi.softAP(AP_SSID, AP_PASSWORD, 6, false, 4);
  Serial.printf("[WIFI] AP %s, SSID=%s, IP=%s\n", started ? "started" : "FAILED", AP_SSID, WiFi.softAPIP().toString().c_str());
  dnsServer.start(DNS_PORT, "*", IPAddress(192, 168, 4, 1));
  if (MDNS.begin(MDNS_HOST)) Serial.printf("[WIFI] http://%s.local\n", MDNS_HOST);
}
void printReport() {
  Serial.println("\n========== AEROTRACE NODE ==========");
  Serial.printf("Modem=%s SIM=%s Reg=%s Operator=%s CSQ=%d RSSI=%d\n", state.modem ? "OK" : "FAIL", state.sim.c_str(), state.registration.c_str(), state.operatorName.c_str(), state.csq, state.rssiDbm);
  Serial.printf("PDP=%s Internet=%s GNSS=%s Fix=%s\n", state.dataConnected ? "UP" : "DOWN", state.internetOK ? "PASS" : "FAIL", state.gnssEnabled ? "ON" : "OFF", state.gpsFix ? "YES" : "NO");
  if (state.gpsFix) Serial.printf("GPS=%.6f, %.6f alt=%.1fm\n", state.lat, state.lon, state.altitude);
  Serial.printf("Sensors: pH=%.2f TDS=%.1fppm Dust=%.1fug/m3 Temp=%.2fC RH=%.2f%%\n", state.ph, state.tdsPpm, state.dustUgM3, state.temperatureC, state.humidityPct);
  Serial.printf("WiFi AP=%s clients=%d IP=%s\n", AP_SSID, WiFi.softAPgetStationNum(), WiFi.softAPIP().toString().c_str());
  if (state.lastError.length()) Serial.printf("ERROR=%s\n", state.lastError.c_str());
  Serial.println("====================================");
}
void setup() {
  Serial.begin(115200); delay(1200);
  Serial.println("\n[AeroTrace] Booting corrected ESP32-S3/A7670E firmware");
  pinMode(MODEM_DTR_PIN, OUTPUT); digitalWrite(MODEM_DTR_PIN, HIGH);
  pinMode(MODEM_RI_PIN, INPUT_PULLUP);
  pinMode(DUST_LED_PIN, OUTPUT); digitalWrite(DUST_LED_PIN, HIGH);
  analogReadResolution(12);
  analogSetPinAttenuation(PH_ANALOG_PIN, ADC_11db); analogSetPinAttenuation(TDS_ANALOG_PIN, ADC_11db); analogSetPinAttenuation(DUST_ANALOG_PIN, ADC_11db);
  Wire.begin(SHT45_SDA_PIN, SHT45_SCL_PIN); state.shtReady = sht4.begin(&Wire);
  startAP(); setupWeb();
  SerialAT.begin(MODEM_BAUD, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN); delay(1500);
  atCommand("ATE0", 1000); atCommand("AT+CMEE=2", 1000);
  for (int attempt = 0; attempt < 8 && !state.modem; attempt++) { pollModem(); if (!state.modem) delay(1500); }
  if (state.modem) { enableGNSS(); pollModem(); connectCellular(); } else state.lastError = "A7670E not responding; check board power and UART";
  readSensors(); printReport();
  lastModemPoll = millis(); lastGpsPoll = millis(); lastTelemetry = millis() - TELEMETRY_MS; lastReport = millis();
}
void loop() {
  dnsServer.processNextRequest(); server.handleClient(); uint32_t now = millis();
  if (now - lastModemPoll >= MODEM_POLL_MS) { lastModemPoll = now; pollModem(); }
  if (now - lastGpsPoll >= GPS_POLL_MS) { lastGpsPoll = now; readGNSS(); }
  if (now - lastTelemetry >= TELEMETRY_MS) { lastTelemetry = now; readSensors(); if (!state.dataConnected) connectCellular(); sendTelemetry(); }
  if (now - lastReport >= SERIAL_REPORT_MS) { lastReport = now; printReport(); }
  delay(2);
}
/* Troubleshooting Smart SIM:
 * 1. Serial Monitor: 115200 baud, line ending CR+LF.
 * 2. Confirm the SIM is active and has Smart LTE data: APN is exactly internet.
 * 3. Wait for CSQ and CEREG registration. CSQ 99 means no usable signal.
 * 4. If AT fails, verify 5V/current capacity, common GND, GPIO18/17 crossing,
 *    and that DTR is HIGH. Do not use a SIM7600 TinyGSM profile for A7670E.
 * 5. AP Wi-Fi is local diagnostics only; it does not route client internet.
 */
