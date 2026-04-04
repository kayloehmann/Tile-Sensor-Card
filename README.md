# Tile Sensor Card

A Home Assistant custom card based on the Tile Card, with a prominently displayed sensor value.

## Installation

### HACS (recommended)

1. Add this repository as a custom repository in HACS
2. Install "Tile Sensor Card"
3. Restart Home Assistant

### Manual

1. Copy `dist/tile-sensor-card.js` to `/config/www/tile-sensor-card/`
2. Add the resource in **Settings > Dashboards > Resources**:
   - URL: `/local/tile-sensor-card/tile-sensor-card.js`
   - Type: JavaScript Module

## Usage

```yaml
type: custom:tile-sensor-card
entity: sensor.temperature
```

## Options

| Option       | Type    | Default  | Description                        |
|-------------|---------|----------|------------------------------------|
| `entity`    | string  | required | Entity ID                          |
| `name`      | string  | auto     | Card name (default: friendly name) |
| `icon`      | string  | auto     | Icon override (e.g. `mdi:thermometer`) |
| `show_icon` | boolean | `true`   | Show/hide the icon                 |
| `value_size`| string  | `2.5rem` | Font size of the sensor value      |

## Example

```yaml
type: custom:tile-sensor-card
entity: weather.forecast_zuhause
name: Wetter
icon: mdi:weather-cloudy
value_size: 3rem
```
