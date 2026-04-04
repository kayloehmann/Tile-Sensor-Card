/**
 * Tile Sensor Card v1.0.0
 *
 * A Home Assistant custom card based on the Tile Card,
 * with a prominently displayed sensor value.
 *
 * https://github.com/kaygdev/tile-sensor-card
 */

const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;
const nothing = LitElement.prototype.nothing;

const CARD_VERSION = "1.0.0";

console.info(
  `%c  TILE-SENSOR-CARD  %c  v${CARD_VERSION}  `,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray"
);

// --- Action handler helper ---

function handleAction(node, hass, config, action) {
  const actionConfig = config[`${action}_action`];
  if (!actionConfig || actionConfig.action === "none") return;

  switch (actionConfig.action) {
    case "more-info": {
      const event = new Event("hass-more-info", {
        bubbles: true,
        composed: true,
      });
      event.detail = {
        entityId: actionConfig.entity || config.entity,
      };
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
      const [domain, service] = (
        actionConfig.service ||
        actionConfig.perform_action ||
        ""
      ).split(".");
      if (domain && service) {
        hass.callService(
          domain,
          service,
          actionConfig.service_data || actionConfig.data || {}
        );
      }
      break;
    }
    case "navigate":
      if (actionConfig.navigation_path) {
        history.pushState(null, "", actionConfig.navigation_path);
        const navEvent = new Event("location-changed", {
          bubbles: true,
          composed: true,
        });
        navEvent.detail = { replace: false };
        window.dispatchEvent(navEvent);
      }
      break;
    case "url":
      if (actionConfig.url_path) {
        window.open(actionConfig.url_path);
      }
      break;
  }
}

// --- Helpers ---

const UNAVAILABLE_STATES = ["unavailable", "unknown"];

function isUnavailable(stateObj) {
  return UNAVAILABLE_STATES.includes(stateObj.state);
}

function formatState(hass, stateObj) {
  if (typeof hass.formatEntityState === "function") {
    return hass.formatEntityState(stateObj);
  }
  const unit = stateObj.attributes.unit_of_measurement;
  return unit ? `${stateObj.state} ${unit}` : stateObj.state;
}

function computeStateColor(stateObj) {
  if (isUnavailable(stateObj)) {
    return null;
  }
  const domain = stateObj.entity_id.split(".")[0];
  const state = stateObj.state;

  if (domain === "light" && state === "on") {
    const rgb = stateObj.attributes.rgb_color;
    if (rgb) {
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
    return "var(--state-light-active-color, var(--color-yellow))";
  }

  const activeStates = {
    switch: ["on"],
    binary_sensor: ["on"],
    fan: ["on"],
    climate: ["heat", "cool", "heat_cool", "auto"],
    cover: ["open", "opening", "closing"],
    lock: ["unlocked"],
    alarm_control_panel: ["armed_home", "armed_away", "armed_night", "armed_custom_bypass", "pending", "triggered"],
  };

  if (activeStates[domain]?.includes(state)) {
    return "var(--state-active-color, var(--color-primary))";
  }

  return null;
}

// --- Main Card ---

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
      tap_action: { action: "more-info" },
    };
  }

  static getConfigElement() {
    return document.createElement("tile-sensor-card-editor");
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to define an entity");
    }
    if (config.value_size && !/^\d+(\.\d+)?(rem|em|px|%)$/.test(config.value_size)) {
      throw new Error(`Invalid value_size: "${config.value_size}". Use CSS units like "2.5rem", "40px", etc.`);
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

  // --- Action handling ---

  _handleTap() {
    handleAction(this, this.hass, this._config, "tap");
  }

  _handleHold() {
    handleAction(this, this.hass, this._config, "hold");
  }

  _handleDoubleTap() {
    handleAction(this, this.hass, this._config, "double_tap");
  }

  connectedCallback() {
    super.connectedCallback();
    this._holdTimer = null;
    this._dblClickTimer = null;
    this._clickCount = 0;
  }

  _handlePointerDown() {
    this._holdTimer = setTimeout(() => {
      this._handleHold();
      this._holdTimer = null;
    }, 500);
  }

  _handlePointerUp() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  _handleClick() {
    this._clickCount++;
    if (this._clickCount === 1) {
      this._dblClickTimer = setTimeout(() => {
        this._clickCount = 0;
        this._handleTap();
      }, 250);
    } else if (this._clickCount === 2) {
      clearTimeout(this._dblClickTimer);
      this._clickCount = 0;
      this._handleDoubleTap();
    }
  }

  _handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._handleTap();
    }
  }

  // --- Render ---

  render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    const entityId = this._config.entity;
    const stateObj = this.hass.states[entityId];

    if (!stateObj) {
      return html`
        <ha-card class="not-found">
          <div class="container">
            <div class="icon-container unavailable">
              <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
            </div>
            <div class="info">
              <span class="name">Entity not found</span>
              <span class="value unavailable-text">${entityId}</span>
            </div>
          </div>
        </ha-card>
      `;
    }

    const name =
      this._config.name ||
      stateObj.attributes.friendly_name ||
      entityId;
    const icon = this._config.icon || stateObj.attributes.icon;
    const showIcon = this._config.show_icon;
    const showName = this._config.show_name;
    const showState = this._config.show_state;
    const valueSize = this._config.value_size;
    const unavailable = isUnavailable(stateObj);
    const stateColor = this._config.color
      ? `var(--color-${this._config.color}, ${this._config.color})`
      : computeStateColor(stateObj);

    const formattedState = formatState(this.hass, stateObj);

    const hasAction =
      this._config.tap_action?.action !== "none";

    return html`
      <ha-card
        class=${unavailable ? "unavailable" : ""}
        style=${stateColor ? `--tile-color: ${stateColor}` : ""}
        @click=${this._handleClick}
        @pointerdown=${this._handlePointerDown}
        @pointerup=${this._handlePointerUp}
        @pointercancel=${this._handlePointerUp}
        @keydown=${this._handleKeyDown}
        tabindex=${hasAction ? "0" : "-1"}
        role=${hasAction ? "button" : "presentation"}
        aria-label="${name}: ${formattedState}"
      >
        <div class="container">
          ${showIcon
            ? html`
                <div
                  class="icon-container ${unavailable ? "unavailable" : ""}"
                >
                  <ha-state-icon
                    .hass=${this.hass}
                    .stateObj=${stateObj}
                    .icon=${icon}
                  ></ha-state-icon>
                </div>
              `
            : ""}
          <div class="info">
            ${showName
              ? html`<span class="name">${name}</span>`
              : ""}
            ${showState
              ? html`
                  <span
                    class="value ${unavailable ? "unavailable-text" : ""}"
                    style="font-size: ${valueSize}"
                  >
                    ${formattedState}
                  </span>
                `
              : ""}
          </div>
        </div>
        ${hasAction ? html`<ha-ripple></ha-ripple>` : ""}
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        --tile-color: var(--state-icon-color, var(--disabled-color));
      }

      ha-card {
        position: relative;
        height: 100%;
        cursor: pointer;
        outline: none;
        padding: 12px;
        box-sizing: border-box;
        transition: box-shadow 180ms ease-in-out;
        overflow: hidden;
      }

      ha-card:focus-visible {
        box-shadow: 0 0 0 2px var(--primary-color);
      }

      ha-card.unavailable {
        opacity: 0.6;
      }

      ha-card.not-found {
        opacity: 0.6;
        cursor: default;
      }

      .container {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 100%;
      }

      .icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 50%;
        background-color: rgba(var(--rgb-state-default-color, 68, 115, 158), 0.1);
        color: var(--tile-color);
        --mdc-icon-size: 24px;
        transition: color 180ms ease-in-out,
          background-color 180ms ease-in-out;
      }

      .icon-container:not(.unavailable) {
        background-color: color-mix(in srgb, var(--tile-color) 20%, transparent);
      }

      .icon-container.unavailable {
        color: var(--disabled-color);
      }

      .info {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
        flex: 1;
        gap: 2px;
      }

      .name {
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        color: var(--primary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .value {
        font-weight: 500;
        line-height: 1.1;
        color: var(--primary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: font-size 180ms ease-in-out;
      }

      .unavailable-text {
        color: var(--secondary-text-color);
        font-size: 1rem !important;
        font-style: italic;
      }

      ha-ripple {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
    `;
  }
}

// --- Visual Config Editor ---

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
      ev.detail !== undefined ? ev.detail.value : target.value;

    if (key === "show_icon" || key === "show_name" || key === "show_state") {
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
    if (!this.hass || !this._config) {
      return html``;
    }

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
    "https://github.com/kaygdev/tile-sensor-card",
});
