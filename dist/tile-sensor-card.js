/**
 * Tile Sensor Card v1.1.0
 *
 * A Home Assistant custom card based on the native Tile Card,
 * with a prominently displayed sensor value.
 *
 * Re-uses HA's built-in tile sub-components (ha-tile-container,
 * ha-tile-icon, ha-tile-info) for pixel-perfect fidelity.
 *
 * https://github.com/kayloehmann/tile-sensor-card
 */

const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;
const nothing = LitElement.prototype.nothing;

const CARD_VERSION = "1.1.0";

console.info(
  `%c  TILE-SENSOR-CARD  %c  v${CARD_VERSION}  `,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray"
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNAVAILABLE_STATES = ["unavailable", "unknown"];

const DOMAINS_TOGGLE = new Set([
  "automation",
  "cover",
  "fan",
  "humidifier",
  "input_boolean",
  "light",
  "lock",
  "media_player",
  "remote",
  "siren",
  "switch",
  "vacuum",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDomain(entityId) {
  return entityId.split(".")[0];
}

function stateActive(stateObj) {
  const domain = computeDomain(stateObj.entity_id);
  const state = stateObj.state;

  if (UNAVAILABLE_STATES.includes(state)) return false;

  // Domain-specific active states
  switch (domain) {
    case "alarm_control_panel":
      return state !== "disarmed";
    case "cover":
      return state !== "closed";
    case "device_tracker":
    case "person":
      return state !== "not_home";
    case "lock":
      return state !== "locked";
    case "vacuum":
      return !["docked", "idle"].includes(state);
    case "plant":
    case "group":
    case "timer":
      return state !== "off" && state !== "idle" && state !== "paused";
    default:
      return state === "on" || state === "open" || state === "playing" ||
        state === "active" || state === "home";
  }
}

function rgb2hsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, v * 255];
}

function hsv2rgb([h, s, v]) {
  h /= 360; s /= 100; v /= 255;
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgb2hex([r, g, b]) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function computeStateColor(stateObj, configColor) {
  const domain = computeDomain(stateObj.entity_id);

  // Custom color: only when active
  if (configColor) {
    if (!stateActive(stateObj)) return undefined;
    // Support named HA colors and hex
    if (configColor.startsWith("#") || configColor.startsWith("rgb")) {
      return configColor;
    }
    return `var(--${configColor}-color, var(--state-icon-color))`;
  }

  // Person/device_tracker: color is on the badge, not the icon
  if (domain === "person" || domain === "device_tracker") {
    return undefined;
  }

  // Light with RGB: use actual light color with contrast adjustment
  if (domain === "light" && stateObj.attributes.rgb_color && stateActive(stateObj)) {
    const hsvColor = rgb2hsv(stateObj.attributes.rgb_color);
    if (hsvColor[1] < 0.4) {
      if (hsvColor[1] < 0.1) {
        hsvColor[2] = 225;
      } else {
        hsvColor[1] = 0.4;
      }
    }
    return rgb2hex(hsv2rgb(hsvColor));
  }

  // Generic active state
  if (stateActive(stateObj)) {
    return "var(--state-icon-color)";
  }

  return undefined;
}

function formatState(hass, stateObj) {
  if (typeof hass.formatEntityState === "function") {
    return hass.formatEntityState(stateObj);
  }
  const unit = stateObj.attributes.unit_of_measurement;
  return unit ? `${stateObj.state} ${unit}` : stateObj.state;
}

function formatName(hass, stateObj, configName) {
  if (configName) return configName;
  if (typeof hass.formatEntityName === "function") {
    return hass.formatEntityName(stateObj);
  }
  return stateObj.attributes.friendly_name || stateObj.entity_id;
}

// ---------------------------------------------------------------------------
// Action handling (mirrors HA's handleAction)
// ---------------------------------------------------------------------------

function fireAction(node, hass, config, action) {
  const actionConfig = config[`${action}_action`];
  if (!actionConfig || actionConfig.action === "none") return;

  switch (actionConfig.action) {
    case "more-info": {
      const event = new Event("hass-more-info", {
        bubbles: true,
        composed: true,
      });
      event.detail = { entityId: actionConfig.entity || config.entity };
      node.dispatchEvent(event);
      break;
    }
    case "toggle":
      hass.callService("homeassistant", "toggle", {
        entity_id: config.entity,
      });
      break;
    case "call-service":
    case "perform-action": {
      const svc = actionConfig.service || actionConfig.perform_action || "";
      const [domain, service] = svc.split(".");
      if (domain && service) {
        hass.callService(domain, service, actionConfig.service_data || actionConfig.data || {});
      }
      break;
    }
    case "navigate":
      if (actionConfig.navigation_path) {
        history.pushState(null, "", actionConfig.navigation_path);
        window.dispatchEvent(
          new CustomEvent("location-changed", { bubbles: true, composed: true, detail: { replace: false } })
        );
      }
      break;
    case "url":
      if (actionConfig.url_path) window.open(actionConfig.url_path);
      break;
  }
}

function hasAction(actionConfig) {
  return actionConfig && actionConfig.action && actionConfig.action !== "none";
}

// ---------------------------------------------------------------------------
// Main Card
// ---------------------------------------------------------------------------

class TileSensorCard extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      _config: { state: true },
    };
  }

  static getStubConfig(hass) {
    const sensors = Object.keys(hass.states).filter((e) =>
      e.startsWith("sensor.")
    );
    return {
      entity: sensors[0] || "sensor.example",
    };
  }

  static getConfigElement() {
    return document.createElement("tile-sensor-card-editor");
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to define an entity");
    }
    if (
      config.value_size &&
      !/^\d+(\.\d+)?(rem|em|px|%)$/.test(config.value_size)
    ) {
      throw new Error(
        `Invalid value_size: "${config.value_size}". Use CSS units like "2.5rem", "40px".`
      );
    }

    this._config = {
      show_icon: true,
      show_name: true,
      show_state: true,
      value_size: "2.5rem",
      tap_action: { action: "more-info" },
      hold_action: { action: "none" },
      double_tap_action: { action: "none" },
      ...config,
    };
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    return {
      columns: 6,
      rows: 2,
      min_columns: 2,
      min_rows: 1,
    };
  }

  // --- Action handling via pointer events ---

  connectedCallback() {
    super.connectedCallback();
    this._holdTimer = null;
    this._dblClickTimer = null;
    this._clickCount = 0;
    this._held = false;
  }

  _onPointerDown() {
    this._held = false;
    this._holdTimer = setTimeout(() => {
      this._held = true;
      fireAction(this, this.hass, this._config, "hold");
    }, 500);
  }

  _onPointerUp() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  _onPointerCancel() {
    this._onPointerUp();
  }

  _onClick() {
    if (this._held) {
      this._held = false;
      return;
    }

    const hasDblTap = hasAction(this._config.double_tap_action);
    if (!hasDblTap) {
      fireAction(this, this.hass, this._config, "tap");
      return;
    }

    this._clickCount++;
    if (this._clickCount === 1) {
      this._dblClickTimer = setTimeout(() => {
        this._clickCount = 0;
        fireAction(this, this.hass, this._config, "tap");
      }, 250);
    } else {
      clearTimeout(this._dblClickTimer);
      this._clickCount = 0;
      fireAction(this, this.hass, this._config, "double_tap");
    }
  }

  _onKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fireAction(this, this.hass, this._config, "tap");
    }
  }

  // --- Render ---

  render() {
    if (!this.hass || !this._config) return nothing;

    const entityId = this._config.entity;
    const stateObj = entityId ? this.hass.states[entityId] : undefined;

    if (!stateObj) {
      return html`
        <ha-card class="not-found">
          <div class="content">
            <div class="icon-shape unavailable">
              <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
            </div>
            <ha-tile-info>
              <span slot="primary">Entity not found</span>
              <span slot="secondary">${entityId}</span>
            </ha-tile-info>
          </div>
        </ha-card>
      `;
    }

    const name = formatName(this.hass, stateObj, this._config.name);
    const icon = this._config.icon;
    const showIcon = this._config.show_icon;
    const showName = this._config.show_name;
    const showState = this._config.show_state;
    const valueSize = this._config.value_size;
    const unavailable = UNAVAILABLE_STATES.includes(stateObj.state);
    const active = stateActive(stateObj);
    const color = computeStateColor(stateObj, this._config.color);
    const interactive =
      !this._config.tap_action ||
      hasAction(this._config.tap_action) ||
      hasAction(this._config.hold_action) ||
      hasAction(this._config.double_tap_action);

    const formattedState = formatState(this.hass, stateObj);

    return html`
      <ha-card
        class="${active ? "active" : ""}"
        style="${color ? `--tile-color: ${color}` : ""}"
      >
        <div
          class="background"
          role=${interactive ? "button" : ""}
          tabindex=${interactive ? "0" : "-1"}
          aria-label="${name}: ${formattedState}"
          @click=${this._onClick}
          @pointerdown=${this._onPointerDown}
          @pointerup=${this._onPointerUp}
          @pointercancel=${this._onPointerCancel}
          @keydown=${this._onKeyDown}
        >
          <ha-ripple .disabled=${!interactive}></ha-ripple>
        </div>
        <div class="content">
          ${showIcon
            ? html`
                <ha-tile-icon>
                  <ha-state-icon
                    slot="icon"
                    .hass=${this.hass}
                    .stateObj=${stateObj}
                    .icon=${icon}
                  ></ha-state-icon>
                </ha-tile-icon>
              `
            : ""}
          <ha-tile-info>
            ${showName
              ? html`<span slot="primary">${name}</span>`
              : nothing}
            ${showState
              ? html`
                  <span
                    slot="secondary"
                    class="sensor-value ${unavailable ? "unavailable" : ""}"
                    style="--sensor-value-size: ${valueSize}"
                  >
                    ${formattedState}
                  </span>
                `
              : nothing}
          </ha-tile-info>
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        --tile-color: var(--state-inactive-color);
      }

      ha-card.active {
        --tile-color: var(--state-icon-color);
      }

      ha-card {
        position: relative;
        height: 100%;
        transition:
          box-shadow 180ms ease-in-out,
          border-color 180ms ease-in-out;
        overflow: hidden;
      }

      ha-card:has(.background:focus-visible) {
        --shadow-default: var(--ha-card-box-shadow, 0 0 0 0 transparent);
        --shadow-focus: 0 0 0 1px var(--tile-color);
        border-color: var(--tile-color);
        box-shadow: var(--shadow-default), var(--shadow-focus);
      }

      ha-card.not-found {
        opacity: 0.6;
        cursor: default;
      }

      .background {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg));
        margin: calc(-1 * var(--ha-card-border-width, 1px));
        overflow: hidden;
      }

      .background[role="button"] {
        cursor: pointer;
      }

      .background:focus {
        outline: none;
      }

      ha-ripple {
        --ha-ripple-color: var(--tile-color);
        --ha-ripple-hover-opacity: 0.04;
        --ha-ripple-pressed-opacity: 0.12;
      }

      .content {
        position: relative;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 10px;
        flex: 1;
        min-width: 0;
        box-sizing: border-box;
        pointer-events: none;
        gap: 10px;
        height: 100%;
      }

      ha-tile-icon {
        --tile-icon-color: var(--tile-color);
        position: relative;
        padding: 6px;
        margin: -6px;
      }

      ha-tile-info {
        flex: 1;
        min-width: 0;
      }

      .sensor-value {
        font-size: var(--sensor-value-size, 2.5rem) !important;
        font-weight: 500 !important;
        line-height: 1.1 !important;
      }

      .sensor-value.unavailable {
        font-size: var(
          --ha-tile-info-secondary-font-size,
          var(--ha-font-size-s)
        ) !important;
        font-style: italic;
        color: var(--secondary-text-color);
      }

      .icon-shape {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border-radius: 50%;
        color: var(--disabled-color);
      }

      .icon-shape.unavailable {
        background-color: rgba(var(--rgb-disabled-color, 111, 118, 125), 0.2);
      }
    `;
  }
}

// ---------------------------------------------------------------------------
// Visual Config Editor
// ---------------------------------------------------------------------------

class TileSensorCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      _config: { state: true },
    };
  }

  setConfig(config) {
    this._config = config;
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;

    const target = ev.target;
    const key = target.configValue;
    let value =
      ev.detail !== undefined && ev.detail.value !== undefined
        ? ev.detail.value
        : target.value;

    if (
      key === "show_icon" ||
      key === "show_name" ||
      key === "show_state"
    ) {
      value = target.checked;
    }

    const newConfig = { ...this._config };
    if (value === "" || value === undefined) {
      delete newConfig[key];
    } else {
      newConfig[key] = value;
    }
    this._config = newConfig;

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.hass || !this._config) return nothing;

    return html`
      <div class="editor">
        <ha-entity-picker
          .hass=${this.hass}
          .value=${this._config.entity}
          .configValue=${"entity"}
          @value-changed=${this._valueChanged}
          allow-custom-entity
        ></ha-entity-picker>
        <ha-textfield
          label="Name (optional)"
          .value=${this._config.name || ""}
          .configValue=${"name"}
          @input=${this._valueChanged}
        ></ha-textfield>
        <ha-icon-picker
          .hass=${this.hass}
          .value=${this._config.icon || ""}
          .configValue=${"icon"}
          @value-changed=${this._valueChanged}
        ></ha-icon-picker>
        <ha-textfield
          label="Value Size (e.g. 2.5rem, 40px)"
          .value=${this._config.value_size || "2.5rem"}
          .configValue=${"value_size"}
          @input=${this._valueChanged}
        ></ha-textfield>
        <div class="switches">
          <ha-formfield label="Show Icon">
            <ha-switch
              .checked=${this._config.show_icon !== false}
              .configValue=${"show_icon"}
              @change=${this._valueChanged}
            ></ha-switch>
          </ha-formfield>
          <ha-formfield label="Show Name">
            <ha-switch
              .checked=${this._config.show_name !== false}
              .configValue=${"show_name"}
              @change=${this._valueChanged}
            ></ha-switch>
          </ha-formfield>
          <ha-formfield label="Show State">
            <ha-switch
              .checked=${this._config.show_state !== false}
              .configValue=${"show_state"}
              @change=${this._valueChanged}
            ></ha-switch>
          </ha-formfield>
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .editor {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }
      .switches {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
    `;
  }
}

customElements.define("tile-sensor-card", TileSensorCard);
customElements.define("tile-sensor-card-editor", TileSensorCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tile-sensor-card",
  name: "Tile Sensor Card",
  description:
    "A tile card with a prominently displayed sensor value",
  preview: true,
  documentationURL:
    "https://github.com/kayloehmann/Tile-Sensor-Card",
});
