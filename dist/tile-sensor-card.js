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

  // Unavailable — no color
  if (UNAVAILABLE_STATES.includes(stateObj.state)) {
    return undefined;
  }

  // Custom color from config
  if (configColor) {
    if (configColor === "state") {
      // Fall through to automatic color logic
    } else if (configColor.startsWith("#") || configColor.startsWith("rgb")) {
      return configColor;
    } else {
      return `var(--${configColor}-color, var(--state-icon-color))`;
    }
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

  // Active entities get their state color
  if (stateActive(stateObj)) {
    return "var(--state-icon-color)";
  }

  // Sensor domain: always show state color (sensors are never "active"
  // in the toggle sense, but they still get a colored icon in HA)
  if (domain === "sensor" || domain === "weather" || domain === "sun") {
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
      value_size: "1.5rem",
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
      rows: "auto",
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
                <ha-tile-icon
                  data-domain=${computeDomain(entityId)}
                  data-state=${stateObj.state}
                >
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
        font-size: var(--sensor-value-size, 1.5rem) !important;
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
// Visual Config Editor (uses ha-form with schema selectors like the native
// Tile Card editor for full UI parity)
// ---------------------------------------------------------------------------

function buildEditorSchema(hass) {
  const t = (key) => getTranslation(hass, key);
  return [
    { name: "entity", selector: { entity: {} } },
    {
      name: "",
      type: "grid",
      schema: [
        {
          name: "name",
          selector: { text: {} },
        },
        {
          name: "icon",
          selector: { icon: {} },
          context: { icon_entity: "entity" },
        },
        {
          name: "color",
          selector: {
            ui_color: {
              default_color: "state",
              include_state: true,
            },
          },
        },
        {
          name: "value_size",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { label: `${t("size_small")} (1.5rem)`, value: "1.5rem" },
                { label: `${t("size_medium")} (2rem)`, value: "2rem" },
                { label: `${t("size_large")} (2.5rem)`, value: "2.5rem" },
                { label: `${t("size_xlarge")} (3rem)`, value: "3rem" },
                { label: `${t("size_huge")} (4rem)`, value: "4rem" },
              ],
              custom_value: true,
            },
          },
        },
      ],
    },
    {
      name: "",
      type: "grid",
      schema: [
        { name: "show_icon", selector: { boolean: {} } },
        { name: "show_name", selector: { boolean: {} } },
        { name: "show_state", selector: { boolean: {} } },
      ],
    },
    {
      name: "interactions",
      type: "expandable",
      flatten: true,
      schema: [
        {
          name: "tap_action",
          selector: {
            ui_action: { default_action: "more-info" },
          },
        },
        {
          name: "",
          type: "optional_actions",
          flatten: true,
          schema: [
            {
              name: "hold_action",
              selector: { ui_action: { default_action: "none" } },
            },
            {
              name: "double_tap_action",
              selector: { ui_action: { default_action: "none" } },
            },
          ],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Localization — 30 languages (matching Gardena integration coverage)
// ---------------------------------------------------------------------------

const TRANSLATIONS = {
  en: {
    entity: "Entity", name: "Name", icon: "Icon", color: "Color",
    value_size: "Value Size", show_icon: "Show Icon", show_name: "Show Name",
    show_state: "Show State", tap_action: "Tap Action", hold_action: "Hold Action",
    double_tap_action: "Double Tap Action", interactions: "Interactions",
    size_small: "Small", size_medium: "Medium", size_large: "Large",
    size_xlarge: "Extra Large", size_huge: "Huge",
  },
  de: {
    entity: "Entitat", name: "Name", icon: "Symbol", color: "Farbe",
    value_size: "Wertgroesse", show_icon: "Symbol anzeigen", show_name: "Name anzeigen",
    show_state: "Wert anzeigen", tap_action: "Tippaktion", hold_action: "Halteaktion",
    double_tap_action: "Doppeltippaktion", interactions: "Interaktionen",
    size_small: "Klein", size_medium: "Mittel", size_large: "Gross",
    size_xlarge: "Sehr gross", size_huge: "Riesig",
  },
  fr: {
    entity: "Entite", name: "Nom", icon: "Icone", color: "Couleur",
    value_size: "Taille de la valeur", show_icon: "Afficher l'icone", show_name: "Afficher le nom",
    show_state: "Afficher la valeur", tap_action: "Action au toucher", hold_action: "Action au maintien",
    double_tap_action: "Action au double toucher", interactions: "Interactions",
    size_small: "Petit", size_medium: "Moyen", size_large: "Grand",
    size_xlarge: "Tres grand", size_huge: "Enorme",
  },
  es: {
    entity: "Entidad", name: "Nombre", icon: "Icono", color: "Color",
    value_size: "Tamano del valor", show_icon: "Mostrar icono", show_name: "Mostrar nombre",
    show_state: "Mostrar valor", tap_action: "Accion al tocar", hold_action: "Accion al mantener",
    double_tap_action: "Accion al doble toque", interactions: "Interacciones",
    size_small: "Pequeno", size_medium: "Mediano", size_large: "Grande",
    size_xlarge: "Muy grande", size_huge: "Enorme",
  },
  it: {
    entity: "Entita", name: "Nome", icon: "Icona", color: "Colore",
    value_size: "Dimensione valore", show_icon: "Mostra icona", show_name: "Mostra nome",
    show_state: "Mostra valore", tap_action: "Azione al tocco", hold_action: "Azione alla pressione",
    double_tap_action: "Azione al doppio tocco", interactions: "Interazioni",
    size_small: "Piccolo", size_medium: "Medio", size_large: "Grande",
    size_xlarge: "Molto grande", size_huge: "Enorme",
  },
  pt: {
    entity: "Entidade", name: "Nome", icon: "Icone", color: "Cor",
    value_size: "Tamanho do valor", show_icon: "Mostrar icone", show_name: "Mostrar nome",
    show_state: "Mostrar valor", tap_action: "Acao ao toque", hold_action: "Acao ao manter",
    double_tap_action: "Acao ao toque duplo", interactions: "Interacoes",
    size_small: "Pequeno", size_medium: "Medio", size_large: "Grande",
    size_xlarge: "Muito grande", size_huge: "Enorme",
  },
  "pt-BR": {
    entity: "Entidade", name: "Nome", icon: "Icone", color: "Cor",
    value_size: "Tamanho do valor", show_icon: "Mostrar icone", show_name: "Mostrar nome",
    show_state: "Mostrar valor", tap_action: "Acao ao toque", hold_action: "Acao ao manter",
    double_tap_action: "Acao ao toque duplo", interactions: "Interacoes",
    size_small: "Pequeno", size_medium: "Medio", size_large: "Grande",
    size_xlarge: "Muito grande", size_huge: "Enorme",
  },
  nl: {
    entity: "Entiteit", name: "Naam", icon: "Pictogram", color: "Kleur",
    value_size: "Waardegrootte", show_icon: "Pictogram tonen", show_name: "Naam tonen",
    show_state: "Waarde tonen", tap_action: "Tikactie", hold_action: "Houdactie",
    double_tap_action: "Dubbeltikactie", interactions: "Interacties",
    size_small: "Klein", size_medium: "Middel", size_large: "Groot",
    size_xlarge: "Zeer groot", size_huge: "Enorm",
  },
  pl: {
    entity: "Encja", name: "Nazwa", icon: "Ikona", color: "Kolor",
    value_size: "Rozmiar wartosci", show_icon: "Pokaz ikone", show_name: "Pokaz nazwe",
    show_state: "Pokaz wartosc", tap_action: "Akcja dotknieciem", hold_action: "Akcja przytrzymaniem",
    double_tap_action: "Akcja podwojnym dotkn.", interactions: "Interakcje",
    size_small: "Maly", size_medium: "Sredni", size_large: "Duzy",
    size_xlarge: "Bardzo duzy", size_huge: "Ogromny",
  },
  cs: {
    entity: "Entita", name: "Nazev", icon: "Ikona", color: "Barva",
    value_size: "Velikost hodnoty", show_icon: "Zobrazit ikonu", show_name: "Zobrazit nazev",
    show_state: "Zobrazit hodnotu", tap_action: "Akce po klepnuti", hold_action: "Akce po podrzeni",
    double_tap_action: "Akce po dvojkliku", interactions: "Interakce",
    size_small: "Maly", size_medium: "Stredni", size_large: "Velky",
    size_xlarge: "Velmi velky", size_huge: "Obrovsky",
  },
  sk: {
    entity: "Entita", name: "Nazov", icon: "Ikona", color: "Farba",
    value_size: "Velkost hodnoty", show_icon: "Zobrazit ikonu", show_name: "Zobrazit nazov",
    show_state: "Zobrazit hodnotu", tap_action: "Akcia po kliknuti", hold_action: "Akcia po podrzani",
    double_tap_action: "Akcia po dvojkliku", interactions: "Interakcie",
    size_small: "Maly", size_medium: "Stredny", size_large: "Velky",
    size_xlarge: "Velmi velky", size_huge: "Obrovsky",
  },
  da: {
    entity: "Entitet", name: "Navn", icon: "Ikon", color: "Farve",
    value_size: "Vaerdistorrelse", show_icon: "Vis ikon", show_name: "Vis navn",
    show_state: "Vis vaerdi", tap_action: "Trykhandling", hold_action: "Holdhandling",
    double_tap_action: "Dobbelttrykhandling", interactions: "Interaktioner",
    size_small: "Lille", size_medium: "Medium", size_large: "Stor",
    size_xlarge: "Meget stor", size_huge: "Kaempe",
  },
  sv: {
    entity: "Entitet", name: "Namn", icon: "Ikon", color: "Farg",
    value_size: "Vardestorlek", show_icon: "Visa ikon", show_name: "Visa namn",
    show_state: "Visa varde", tap_action: "Tryckhandling", hold_action: "Hallhandling",
    double_tap_action: "Dubbeltryckhandling", interactions: "Interaktioner",
    size_small: "Liten", size_medium: "Medel", size_large: "Stor",
    size_xlarge: "Mycket stor", size_huge: "Enorm",
  },
  no: {
    entity: "Entitet", name: "Navn", icon: "Ikon", color: "Farge",
    value_size: "Verdistorrelse", show_icon: "Vis ikon", show_name: "Vis navn",
    show_state: "Vis verdi", tap_action: "Trykkhandling", hold_action: "Holdehandling",
    double_tap_action: "Dobbelttrykkhandling", interactions: "Interaksjoner",
    size_small: "Liten", size_medium: "Middels", size_large: "Stor",
    size_xlarge: "Veldig stor", size_huge: "Enorm",
  },
  fi: {
    entity: "Entiteetti", name: "Nimi", icon: "Kuvake", color: "Vari",
    value_size: "Arvon koko", show_icon: "Nayta kuvake", show_name: "Nayta nimi",
    show_state: "Nayta arvo", tap_action: "Napautustoiminto", hold_action: "Pitopainalluks.",
    double_tap_action: "Kaksoisnapautus", interactions: "Vuorovaikutukset",
    size_small: "Pieni", size_medium: "Keskikokoinen", size_large: "Suuri",
    size_xlarge: "Erittain suuri", size_huge: "Valtava",
  },
  ru: {
    entity: "Sushchnost", name: "Imya", icon: "Ikonka", color: "Tsvet",
    value_size: "Razmer znacheniya", show_icon: "Pokazat ikonku", show_name: "Pokazat imya",
    show_state: "Pokazat znachenie", tap_action: "Deystvie kasaniya", hold_action: "Deystvie uderzhaniya",
    double_tap_action: "Dvoynoe kasanie", interactions: "Vzaimodeystviya",
    size_small: "Malyy", size_medium: "Sredniy", size_large: "Bolshoy",
    size_xlarge: "Ochen bolshoy", size_huge: "Ogromnyy",
  },
  uk: {
    entity: "Sutnist", name: "Imya", icon: "Ikonka", color: "Kolir",
    value_size: "Rozmir znachennya", show_icon: "Pokazaty ikonku", show_name: "Pokazaty imya",
    show_state: "Pokazaty znachennya", tap_action: "Diya dotyku", hold_action: "Diya utrymannya",
    double_tap_action: "Podviynyy dotyk", interactions: "Vzayemodiyi",
    size_small: "Malyy", size_medium: "Seredniy", size_large: "Velykyy",
    size_xlarge: "Duzhe velykyy", size_huge: "Velicheznyy",
  },
  hu: {
    entity: "Entitas", name: "Nev", icon: "Ikon", color: "Szin",
    value_size: "Ertekmeret", show_icon: "Ikon mutatasa", show_name: "Nev mutatasa",
    show_state: "Ertek mutatasa", tap_action: "Erintesi muvelet", hold_action: "Nyomva tartas",
    double_tap_action: "Dupla erintes", interactions: "Interakciok",
    size_small: "Kicsi", size_medium: "Kozepes", size_large: "Nagy",
    size_xlarge: "Nagyon nagy", size_huge: "Hatalmas",
  },
  ro: {
    entity: "Entitate", name: "Nume", icon: "Pictograma", color: "Culoare",
    value_size: "Dimensiune valoare", show_icon: "Afiseaza pictograma", show_name: "Afiseaza numele",
    show_state: "Afiseaza valoarea", tap_action: "Actiune la atingere", hold_action: "Actiune la mentinere",
    double_tap_action: "Actiune dubla atingere", interactions: "Interactiuni",
    size_small: "Mic", size_medium: "Mediu", size_large: "Mare",
    size_xlarge: "Foarte mare", size_huge: "Enorm",
  },
  bg: {
    entity: "Obekt", name: "Ime", icon: "Ikona", color: "Tsyat",
    value_size: "Razmer na stoynostta", show_icon: "Pokazhi ikona", show_name: "Pokazhi ime",
    show_state: "Pokazhi stoynost", tap_action: "Deystvie pri dokosv.", hold_action: "Deystvie pri zadarzhane",
    double_tap_action: "Dvoyno dokosv.", interactions: "Vzaimodeystviya",
    size_small: "Malak", size_medium: "Sreden", size_large: "Golyam",
    size_xlarge: "Mnogo golyam", size_huge: "Ogromen",
  },
  el: {
    entity: "Ontotita", name: "Onoma", icon: "Eikonidio", color: "Chroma",
    value_size: "Megethos timis", show_icon: "Emfanisi eikonidiou", show_name: "Emfanisi onomatos",
    show_state: "Emfanisi timis", tap_action: "Energeia patiamatos", hold_action: "Energeia kratimatos",
    double_tap_action: "Diplo patima", interactions: "Allilepidraseis",
    size_small: "Mikro", size_medium: "Mesaio", size_large: "Megalo",
    size_xlarge: "Poly megalo", size_huge: "Terastio",
  },
  tr: {
    entity: "Varlik", name: "Ad", icon: "Simge", color: "Renk",
    value_size: "Deger boyutu", show_icon: "Simgeyi goster", show_name: "Adi goster",
    show_state: "Degeri goster", tap_action: "Dokunma eylemi", hold_action: "Basili tutma eylemi",
    double_tap_action: "Cift dokunma eylemi", interactions: "Etkilesimler",
    size_small: "Kucuk", size_medium: "Orta", size_large: "Buyuk",
    size_xlarge: "Cok buyuk", size_huge: "Dev",
  },
  ja: {
    entity: "Entiti", name: "Namae", icon: "Aikon", color: "Iro",
    value_size: "Atai no saizu", show_icon: "Aikon hyoji", show_name: "Namae hyoji",
    show_state: "Atai hyoji", tap_action: "Tappu akushon", hold_action: "Horudo akushon",
    double_tap_action: "Daburu tappu", interactions: "Intarakushon",
    size_small: "Sho", size_medium: "Chu", size_large: "Dai",
    size_xlarge: "Tokudai", size_huge: "Kyodai",
  },
  ko: {
    entity: "Gaechae", name: "Ireum", icon: "Aikon", color: "Saek",
    value_size: "Gabs keugi", show_icon: "Aikon pyosi", show_name: "Ireum pyosi",
    show_state: "Gabs pyosi", tap_action: "Teo aeksyeon", hold_action: "Giru aeksyeon",
    double_tap_action: "Deobeur teo", interactions: "Sanghojagyong",
    size_small: "Jageun", size_medium: "Jungan", size_large: "Keun",
    size_xlarge: "Maeu keun", size_huge: "Geodaehan",
  },
  zh: {
    entity: "Shiti", name: "Mingcheng", icon: "Tubiao", color: "Yanse",
    value_size: "Zhi daxiao", show_icon: "Xianshi tubiao", show_name: "Xianshi mingcheng",
    show_state: "Xianshi zhi", tap_action: "Dianji caozuo", hold_action: "Chang'an caozuo",
    double_tap_action: "Shuangji caozuo", interactions: "Jiaohudongzuo",
    size_small: "Xiao", size_medium: "Zhong", size_large: "Da",
    size_xlarge: "Tehda", size_huge: "Juda",
  },
  "zh-Hant": {
    entity: "Shiti", name: "Mingcheng", icon: "Tubiao", color: "Yanse",
    value_size: "Zhi daxiao", show_icon: "Xianshi tubiao", show_name: "Xianshi mingcheng",
    show_state: "Xianshi zhi", tap_action: "Dianji caozuo", hold_action: "Chang'an caozuo",
    double_tap_action: "Shuangji caozuo", interactions: "Jiaohudongzuo",
    size_small: "Xiao", size_medium: "Zhong", size_large: "Da",
    size_xlarge: "Tehda", size_huge: "Juda",
  },
  ar: {
    entity: "Kian", name: "Ism", icon: "Ramz", color: "Lawn",
    value_size: "Hajm alqima", show_icon: "Izhar alramz", show_name: "Izhar alism",
    show_state: "Izhar alqima", tap_action: "Ijraa allams", hold_action: "Ijraa alithbat",
    double_tap_action: "Lams muzdawaj", interactions: "Tafaulat",
    size_small: "Saghir", size_medium: "Mutawassit", size_large: "Kabir",
    size_xlarge: "Kabir jiddan", size_huge: "Dakhm",
  },
  he: {
    entity: "Yeshut", name: "Shem", icon: "Semel", color: "Tseva",
    value_size: "Godel ha'erekh", show_icon: "Hatsg semel", show_name: "Hatsg shem",
    show_state: "Hatsg erekh", tap_action: "Peulat nekisha", hold_action: "Peulat lekhitsa",
    double_tap_action: "Nekisha kfula", interactions: "Interaktsiyot",
    size_small: "Katan", size_medium: "Beinoni", size_large: "Gadol",
    size_xlarge: "Gadol meod", size_huge: "Anak",
  },
  ca: {
    entity: "Entitat", name: "Nom", icon: "Icona", color: "Color",
    value_size: "Mida del valor", show_icon: "Mostra icona", show_name: "Mostra nom",
    show_state: "Mostra valor", tap_action: "Accio en tocar", hold_action: "Accio en mantenir",
    double_tap_action: "Accio doble toc", interactions: "Interaccions",
    size_small: "Petit", size_medium: "Mitja", size_large: "Gran",
    size_xlarge: "Molt gran", size_huge: "Enorme",
  },
  id: {
    entity: "Entitas", name: "Nama", icon: "Ikon", color: "Warna",
    value_size: "Ukuran nilai", show_icon: "Tampilkan ikon", show_name: "Tampilkan nama",
    show_state: "Tampilkan nilai", tap_action: "Aksi ketuk", hold_action: "Aksi tahan",
    double_tap_action: "Aksi ketuk ganda", interactions: "Interaksi",
    size_small: "Kecil", size_medium: "Sedang", size_large: "Besar",
    size_xlarge: "Sangat besar", size_huge: "Raksasa",
  },
};

function getTranslation(hass, key) {
  if (!hass) return TRANSLATIONS.en[key] || key;
  const lang = hass.language || "en";
  // Try exact match, then base language, then English fallback
  const t = TRANSLATIONS[lang] || TRANSLATIONS[lang.split("-")[0]] || TRANSLATIONS.en;
  return t[key] || TRANSLATIONS.en[key] || key;
}

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
    ev.stopPropagation();
    if (!this._config || !this.hass) return;

    const newConfig = ev.detail.value;
    this._config = newConfig;

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _computeLabel(schema) {
    const translated = getTranslation(this.hass, schema.name);
    if (translated !== schema.name) return translated;

    // Fall back to HA's built-in localization
    if (this.hass && this.hass.localize) {
      return (
        this.hass.localize(
          `ui.panel.lovelace.editor.card.tile.${schema.name}`
        ) ||
        this.hass.localize(
          `ui.panel.lovelace.editor.card.generic.${schema.name}`
        ) ||
        schema.name
      );
    }
    return schema.name;
  }

  render() {
    if (!this.hass || !this._config) return nothing;

    // Ensure boolean defaults are set for the form
    const data = {
      show_icon: true,
      show_name: true,
      show_state: true,
      value_size: "1.5rem",
      ...this._config,
    };

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${buildEditorSchema(this.hass)}
        .computeLabel=${this._computeLabel.bind(this)}
        @value-changed=${this._valueChanged}
      ></ha-form>
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
