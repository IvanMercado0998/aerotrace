# AeroTrace Dashboard - User Guide

## Getting Started

### Login
- Navigate to the sign-in page
- Enter credentials:
  - **Username**: `AEROTRACE2026`
  - **Password**: `AerotraceMonitor!`
- Click "Sign In" to access the dashboard

### Dashboard Overview
The main dashboard displays:
- **Full-screen interactive map** centered on Pampanga, Central Luzon
- **Overlay panels** with air quality data, anomalies, and controls
- **Bottom control bar** for quick access to features
- **Header** with filters and utilities

---

## Key Features

### 1. Air Quality Index Card (Left Panel)

**What it shows:**
- Current AQI value for selected monitoring node
- Station name
- Mini trend chart (last 10 readings)

**How to use:**
- Click "More details →" for comprehensive analysis
- Select different nodes from the map to update data
- AQI value changes based on node selection

**AQI Ranges:**
- 0-50: Good ✅ (Green)
- 51-100: Moderate ⚠️ (Yellow)
- 101-150: Unhealthy 🔴 (Orange)
- 151+: Hazardous 🔴🔴 (Red)

---

### 2. Anomaly Detection (Left Panel)

**What it shows:**
- Real-time detected pollution events
- Severity levels (High/Critical/Medium)
- Timestamp of detection

**Severity Indicators:**
- 🔴 **Critical**: Node offline, immediate action needed
- 🟠 **High**: Severe pollution event
- 🟡 **Medium**: Concerning trend
- 🔵 **Low**: Minor variation

**How to use:**
- Review anomalies at a glance
- Click "See all →" for detailed anomaly history
- Take action on critical alerts immediately

---

### 3. Node Management Panel

**Access:** Click the "Nodes" button (bottom center)

**Features:**

#### Add New Node
1. Click "Add New Node" button
2. Enter node name when prompted
3. Enter latitude and longitude (or use defaults)
4. Node is created and appears in the list

#### View Node Status
- Each node shows:
  - Name and coordinates
  - Mode (Real-time or Manual)
  - Ping status (🟢 Active or 🔴 Offline)

#### Expand Node Actions
- Click on any node card to expand
- Two action buttons appear:
  - **Simulate Reading**: Generate mock air quality data
  - **Ping Test**: Check if node is actively responding

#### Simulate Reading
1. Expand a node card
2. Click "Simulate Reading"
3. Realistic air quality data is generated
4. Data appears in the Air Quality Index card

#### Ping Test
1. Expand a node card
2. Click "Ping Test"
3. Status updates to Active (green) or Offline (red)
4. Last ping time is recorded

---

### 4. History Log Panel

**Access:** Click the "History" button (bottom center)

**What it shows:**
- Daily entries for selected node
- Dates, readings count, and daily ratings

**Daily Information:**
- **Date**: Entry date
- **Readings**: Number of data points recorded that day
- **Daily Rating**: Color-coded badge
  - 🟢 Green: Good
  - 🟡 Yellow: Moderate
  - 🟠 Orange: Unhealthy
  - 🔴 Red: Hazardous

**Detailed View:**
1. Click on any date entry to expand
2. View detailed statistics:
   - Average AQI for the day
   - Peak (highest) AQI recorded
   - Total readings count

3. Click again to collapse

---

### 5. Location Search

**Access:** Click the search icon (🔍) in the header

**How to use:**
1. Search panel opens at the top
2. Type location name in the search box
3. Matching results appear with type badges
4. Available location types:
   - 🏙️ **City**: Major urban areas
   - 🏘️ **Town**: Smaller settlements
   - 🌋 **Volcano**: Natural pollution source (Pinatubo)
   - ⛏️ **Quarry**: Mining operations
   - 🏭 **Industrial**: Manufacturing zones
   - 🏢 **Cement Plant**: Heavy industry

5. Click on a result to navigate the map to that location

**Sample Searches:**
- "San Fernando" → Navigate to San Fernando City
- "volcano" → Navigate to Mount Pinatubo
- "quarry" → Navigate to local quarries
- "industrial" → Navigate to industrial zones

---

### 6. Pollution Source Visualization

**Map Display:**
Pollution sources appear as colored circles with icons:

| Icon | Type | Color | Meaning |
|------|------|-------|---------|
| 🌋 | Volcano | Dark Red | Natural emission source |
| ⛏️ | Quarry | Orange | Mining operations |
| 🏭 | Factory | Purple | Manufacturing |
| 🏗️ | Industrial | Orange-Red | Industrial complex |
| 🏢 | Cement Plant | Red | Heavy cement production |
| ⚡ | Power Plant | Pink | Energy generation |

**Hover over sources:** Popup shows name, type, and impact area

---

### 7. Monitoring Node Markers

**Color Coding (by AQI rating):**
- 🟢 **Green**: Good air quality
- 🟡 **Yellow**: Moderate pollution
- 🟠 **Orange**: Unhealthy levels
- 🔴 **Red**: Hazardous levels
- 🔵 **Blue**: Unknown/no data

**Node Animations:**
- Real-time nodes pulse with a ripple effect
- Manual nodes display statically

**Selecting a Node:**
1. Click on any node marker on the map
2. Node enlarges with blue glow
3. Details panel appears on the right
4. Air Quality Index updates
5. History for that node becomes available

---

### 8. Filtering & Controls

**Header Filters:**
- **Air Quality Metric**: Select what to display (Air quality, PM2.5, PM10)
- **Pollutant Type**: Filter by specific pollutant (All, PM2.5, PM10, NO₂)
- **Region**: Choose region (Luzon, Visayas, Mindanao)
- **Time Range**: Select data period (24h, 7d, 30d, 5y)

**How to use:**
1. Adjust filter dropdowns
2. Click "Apply filters"
3. Map and data update accordingly

---

### 9. Bottom Control Bar

**Buttons (Left to Right):**
- **📍 Nodes**: Toggle Node Management Panel
- **📅 History**: Toggle History Log Panel
- **📊 Layers**: Map layer controls
- **🔄 Refresh**: Reload all data from server
- **⛶ Fullscreen**: Enter fullscreen map view

---

### 10. Header Actions

**Left Side:**
- **AeroTrace Logo**: Click to return to landing page
- **Filter Dropdowns**: Customize data display

**Right Side:**
- **🔍 Search**: Open location search
- **Apply Filters**: Apply changes to filter selections
- **Logout**: Exit admin session

---

## Tips & Best Practices

### 1. Node Management
- Create nodes at strategic pollution monitoring points
- Use meaningful names for easy identification
- Regularly test ping to ensure node connectivity
- Simulate readings to test system response

### 2. Monitoring
- Check anomaly detection daily for alerts
- Review history trends weekly to identify patterns
- Pay attention to readings near pollution sources
- Correlate spikes with local events or weather

### 3. Navigation
- Use location search to quickly jump to areas of interest
- Zoom in/out on map for detailed or overview analysis
- Combine map view with data panels for comprehensive analysis

### 4. Data Interpretation
- Green ratings indicate safe air quality
- Red ratings require immediate investigation
- Compare daily averages to peak readings to understand variation
- Check history trends for seasonal patterns

---

## Troubleshooting

### Issue: Map not loading
- **Solution**: Refresh the page (Ctrl+R or Cmd+R)
- Check internet connection
- Clear browser cache

### Issue: No nodes appearing
- **Solution**: Click "Add New Node" to create monitoring stations
- Check that nodes have valid coordinates
- Verify nodes are set to "realtime" or "manual" mode

### Issue: History showing no data
- **Solution**: First generate some readings by using "Simulate Reading"
- History requires at least one data point per day
- Wait for automatic polling if real-time mode is enabled

### Issue: Location search not working
- **Solution**: Check spelling of location name
- Try partial searches (e.g., "san" for "San Fernando")
- Supported locations are limited to Pampanga region

### Issue: Logout not working
- **Solution**: Try clearing browser cookies
- Close browser and reopen
- Contact system administrator

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Close open panels |
| `Ctrl/Cmd + R` | Refresh data |
| `Ctrl/Cmd + F` | Open location search |

---

## Data Storage

All data is securely stored in:
- **Database**: Neon PostgreSQL
- **Backup**: Automatic daily backups
- **Retention**: Historical data retained for 5 years

---

## Support & Contact

For issues or feature requests:
1. Check this user guide first
2. Verify your admin credentials
3. Try refreshing the page
4. Contact the system administrator

---

## Quick Start Checklist

- [ ] Log in with admin credentials
- [ ] Familiarize yourself with the dashboard layout
- [ ] Add a monitoring node
- [ ] Search for a location
- [ ] Generate a simulated reading
- [ ] Review anomaly detection
- [ ] Check historical data
- [ ] Test node connectivity with ping test

---

**Last Updated**: 2026
**Version**: 1.0
**Status**: Active & Fully Functional ✨
