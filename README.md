# Tile Sensor Card

[![HACS](https://img.shields.io/badge/HACS-Custom-blue.svg)](https://hacs.xyz)
[![GitHub Release](https://img.shields.io/github/v/release/kayloehmann/Tile-Sensor-Card)](https://github.com/kayloehmann/Tile-Sensor-Card/releases)
[![License](https://img.shields.io/github/license/kayloehmann/Tile-Sensor-Card)](LICENSE)

A Home Assistant custom card based on the native [Tile Card](https://www.home-assistant.io/dashboards/tile/), with a **configurable sensor value size** for better readability.

Uses the same built-in HA components (`ha-tile-icon`, `ha-tile-info`, `ha-ripple`) as the original Tile Card for pixel-perfect consistency.

## Why?

The default Tile Card displays sensor values in a small secondary font, which can be hard to read at a glance:

| Tile Card (default) | Tile Sensor Card |
|---|---|
| Wetter | Wetter |
| ~~10,8 °C · Bewolkt~~ (small) | **10,8 °C** (large, configurable) |

## Installation

### HACS (recommended)

1. Open **HACS** > **Frontend**
2. Click the three-dot menu > **Custom repositories**
3. Add `kayloehmann/Tile-Sensor-Card` with category **Dashboard**
4. Search for "Tile Sensor Card" and install it
5. Restart Home Assistant

### Manual

1. Download `tile-sensor-card.js` from the [latest release](https://github.com/kayloehmann/Tile-Sensor-Card/releases)
2. Copy it to `/config/www/tile-sensor-card/tile-sensor-card.js`
3. Go to **Settings > Dashboards > Resources** and add:
   - URL: `/local/tile-sensor-card/tile-sensor-card.js`
   - Type: JavaScript Module
4. Restart Home Assistant

## Usage

```yaml
type: custom:tile-sensor-card
entity: sensor.temperature
```

A visual editor is available when adding the card via the UI.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | *required* | Entity ID |
| `name` | string | entity name | Override the display name |
| `icon` | string | entity icon | Override the icon (e.g. `mdi:thermometer`) |
| `color` | string | state-based | Color (named HA color or hex, e.g. `blue`, `#ff5500`) |
| `show_icon` | boolean | `true` | Show or hide the icon |
| `show_name` | boolean | `true` | Show or hide the name |
| `show_state` | boolean | `true` | Show or hide the sensor value |
| `value_size` | string | `2.5rem` | Font size of the sensor value (CSS units) |
| `tap_action` | object | `more-info` | Action on tap |
| `hold_action` | object | `none` | Action on hold |
| `double_tap_action` | object | `none` | Action on double tap |

### Actions

Actions follow the standard [Home Assistant action syntax](https://www.home-assistant.io/dashboards/actions/):

```yaml
tap_action:
  action: more-info     # more-info | toggle | call-service | navigate | url | none
hold_action:
  action: toggle
double_tap_action:
  action: navigate
  navigation_path: /lovelace/climate
```

## Examples

### Basic sensor

```yaml
type: custom:tile-sensor-card
entity: sensor.living_room_temperature
```

### Large value with custom icon

```yaml
type: custom:tile-sensor-card
entity: sensor.outdoor_temperature
name: Aussen
icon: mdi:thermometer
value_size: 3rem
```

### Weather entity

```yaml
type: custom:tile-sensor-card
entity: weather.forecast_zuhause
name: Wetter
icon: mdi:weather-partly-cloudy
```

### Compact (no name, just the value)

```yaml
type: custom:tile-sensor-card
entity: sensor.humidity
show_name: false
value_size: 2rem
```

### Custom color

```yaml
type: custom:tile-sensor-card
entity: sensor.co2
color: red
value_size: 2.5rem
```

## Compatibility

- Home Assistant 2024.1+
- HACS compatible
- Supports light and dark themes
- Keyboard and screen reader accessible

## License

[MIT](LICENSE)
