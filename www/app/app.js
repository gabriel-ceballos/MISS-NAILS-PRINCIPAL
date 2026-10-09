var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@capacitor/core/dist/index.js
var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp, SystemBarsStyle, SystemBarType, SystemBarsPluginWeb, SystemBars;
var init_dist = __esm({
  "node_modules/@capacitor/core/dist/index.js"() {
    (function(ExceptionCode2) {
      ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode2["Unavailable"] = "UNAVAILABLE";
    })(ExceptionCode || (ExceptionCode = {}));
    CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve) => call.then(() => resolve({ remove })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              // https://github.com/facebook/react/issues/20030
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    registerPlugin = Capacitor.registerPlugin;
    WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        if (index !== -1) {
          this.listeners[eventName].splice(index, 1);
        }
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key = decode(key).trim();
          value = decode(value).trim();
          cookieMap[key] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str) => {
            encodedValue = shouldEncode ? encodeURIComponent(str) : str;
            item += `${key}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
          params.set(key, value);
        }
        output.body = params.toString();
      } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key) => {
            form.append(key, value);
          });
        } else {
          for (const key of Object.keys(options.data)) {
            form.append(key, options.data[key]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
    (function(SystemBarsStyle2) {
      SystemBarsStyle2["Dark"] = "DARK";
      SystemBarsStyle2["Light"] = "LIGHT";
      SystemBarsStyle2["Default"] = "DEFAULT";
    })(SystemBarsStyle || (SystemBarsStyle = {}));
    (function(SystemBarType2) {
      SystemBarType2["StatusBar"] = "StatusBar";
      SystemBarType2["NavigationBar"] = "NavigationBar";
    })(SystemBarType || (SystemBarType = {}));
    SystemBarsPluginWeb = class extends WebPlugin {
      async setStyle() {
        this.unavailable("not available for web");
      }
      async setAnimation() {
        this.unavailable("not available for web");
      }
      async show() {
        this.unavailable("not available for web");
      }
      async hide() {
        this.unavailable("not available for web");
      }
    };
    SystemBars = registerPlugin("SystemBars", {
      web: () => new SystemBarsPluginWeb()
    });
  }
});

// node_modules/@capacitor/browser/dist/esm/web.js
var web_exports = {};
__export(web_exports, {
  Browser: () => Browser,
  BrowserWeb: () => BrowserWeb
});
var BrowserWeb, Browser;
var init_web = __esm({
  "node_modules/@capacitor/browser/dist/esm/web.js"() {
    init_dist();
    BrowserWeb = class extends WebPlugin {
      constructor() {
        super();
        this._lastWindow = null;
      }
      async open(options) {
        this._lastWindow = window.open(options.url, options.windowName || "_blank");
      }
      async close() {
        return new Promise((resolve, reject) => {
          if (this._lastWindow != null) {
            this._lastWindow.close();
            this._lastWindow = null;
            resolve();
          } else {
            reject("No active window to close!");
          }
        });
      }
    };
    Browser = new BrowserWeb();
  }
});

// node_modules/@capacitor/app/dist/esm/web.js
var web_exports2 = {};
__export(web_exports2, {
  AppWeb: () => AppWeb
});
var AppWeb;
var init_web2 = __esm({
  "node_modules/@capacitor/app/dist/esm/web.js"() {
    init_dist();
    AppWeb = class extends WebPlugin {
      constructor() {
        super();
        this.handleVisibilityChange = () => {
          const data = {
            isActive: document.hidden !== true
          };
          this.notifyListeners("appStateChange", data);
          if (document.hidden) {
            this.notifyListeners("pause", null);
          } else {
            this.notifyListeners("resume", null);
          }
        };
        document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
      }
      exitApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getInfo() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getLaunchUrl() {
        return { url: "" };
      }
      async getState() {
        return { isActive: document.hidden !== true };
      }
      async minimizeApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async toggleBackButtonHandler() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getAppLanguage() {
        return {
          value: navigator.language.split("-")[0].toLowerCase()
        };
      }
    };
  }
});

// app/runtime/context.js
function detectRuntime() {
  const capacitor = window.Capacitor;
  if (capacitor && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform()) {
    const platform = typeof capacitor.getPlatform === "function" ? capacitor.getPlatform() : "native";
    return { runtime: "native", platform: platform === "ios" ? "ios" : "android" };
  }
  let standalone = false;
  try {
    standalone = window.matchMedia("(display-mode: standalone)").matches;
  } catch {
  }
  if (!standalone && typeof navigator.standalone === "boolean") standalone = navigator.standalone;
  return { runtime: standalone ? "pwa" : "web", platform: "web" };
}
function detectDisplayMode() {
  const modes = ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"];
  for (const mode of modes) {
    try {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) return mode;
    } catch {
    }
  }
  return "browser";
}
function detectInteraction() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const hover = window.matchMedia("(hover: hover)").matches;
  if (coarse && fine) return "hybrid";
  if (coarse) return "touch";
  if (hover || fine) return "mouse-keyboard";
  return "unknown";
}
function applyRuntimeContext(app2) {
  const runtime = detectRuntime();
  app2.dataset.runtime = runtime.runtime;
  app2.dataset.platform = runtime.platform;
  app2.dataset.displayMode = detectDisplayMode();
  app2.dataset.interaction = detectInteraction();
  app2.dataset.orientation = window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape";
  return runtime;
}
function updateDynamicContext(app2) {
  app2.dataset.displayMode = detectDisplayMode();
  app2.dataset.interaction = detectInteraction();
  app2.dataset.orientation = window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape";
}

// app/navigation/router.js
var TITLES = { catalogo: "Cat\xE1logo", carrito: "Carrito", pedidos: "Pedidos", cuenta: "Mi cuenta" };
function createRouter(app2) {
  const panels = [...document.querySelectorAll("[data-view-panel]")];
  const navItems = [...document.querySelectorAll(".mn-nav-item")];
  function renderView() {
    const requested = location.hash.replace("#", "").toLowerCase();
    const view = TITLES[requested] ? requested : "catalogo";
    panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
    navItems.forEach((item) => {
      const active = item.dataset.view === view;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    app2.dataset.view = view;
    app2.dataset.shell = view === "pedidos" || view === "cuenta" ? "account" : "shopping";
    document.title = `MISS NAILS \xB7 ${TITLES[view]} \xB7 Preview`;
  }
  window.addEventListener("hashchange", renderView);
  renderView();
  return { renderView };
}

// app/features/catalog.js
var API_URL = "https://miss-nails-api.ceballosgg2000.workers.dev/";
var INITIAL_BATCH = 40;
var BATCH_SIZE = 40;
var INVENTORY_REFRESH_MS = 5e3;
var CATALOG_DB_NAME = "miss-nails-catalog";
var CATALOG_DB_STORE = "catalog";
var CATALOG_DB_KEY = "latest";
var CATALOG_REQUEST_TIMEOUT_MS = 8e3;
var state = {
  products: [],
  filtered: [],
  rendered: 0,
  category: "",
  query: "",
  observer: null,
  loadingMore: false,
  inventoryRefreshTimer: null,
  inventoryRefreshing: false
};
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value ?? "").replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}
function formatPrice(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2
  }).format(parsePrice(value));
}
function imageUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(raw)}&sz=w800`;
}
function openCatalogDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }
    const request = indexedDB.open(CATALOG_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CATALOG_DB_STORE)) {
        db.createObjectStore(CATALOG_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB no disponible."));
  });
}
async function readCatalogCache() {
  const db = await openCatalogDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CATALOG_DB_STORE, "readonly");
    const store = transaction.objectStore(CATALOG_DB_STORE);
    const request = store.get(CATALOG_DB_KEY);
    request.onsuccess = () => {
      const value = request.result;
      resolve(Array.isArray(value?.products) ? value.products : null);
    };
    request.onerror = () => reject(request.error || new Error("No se pudo leer el cat\xE1logo local."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}
async function writeCatalogCache(products) {
  if (!Array.isArray(products)) return;
  const db = await openCatalogDb();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(CATALOG_DB_STORE, "readwrite");
    transaction.objectStore(CATALOG_DB_STORE).put({
      products,
      savedAt: Date.now()
    }, CATALOG_DB_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar el cat\xE1logo local."));
  }).finally(() => db.close());
}
function renderCatalogState() {
  renderCategories();
  renderBatch(true);
}
async function fetchProducts() {
  const body = new URLSearchParams();
  body.append("accion", "productos");
  body.append("datos", "{}");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CATALOG_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body,
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`API productos: HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      throw new TypeError("La API de productos no devolvi\xF3 JSON.");
    }
    const result = await response.json();
    if (!result?.ok || !Array.isArray(result.datos)) {
      throw new Error(result?.mensaje || "La API no devolvi\xF3 productos v\xE1lidos.");
    }
    return result.datos;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al consultar el cat\xE1logo.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
function categoryLabel(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}
function buildCategories(products) {
  const seen = /* @__PURE__ */ new Set();
  const categories = [];
  for (const product of products) {
    const value = String(product?.categoria ?? "").trim();
    if (!value) continue;
    const key = value.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    categories.push({ value, label: categoryLabel(value) });
  }
  return categories;
}
function matches(product) {
  const category = String(product?.categoria ?? "").trim().toUpperCase();
  if (state.category && category !== state.category) return false;
  if (!state.query) return true;
  const query = state.query.toLowerCase();
  return [product?.nombre, product?.sku, product?.codigo, product?.categoria].some((value) => String(value ?? "").toLowerCase().includes(query));
}
function createProduct(product) {
  const id = escapeHtml(product?.id ?? "");
  const name = escapeHtml(product?.nombre || "Producto sin nombre");
  const category = escapeHtml(product?.categoria || "");
  const inventory = Number(product?.inventario) || 0;
  const image = imageUrl(product?.imagen);
  const price = formatPrice(product?.precio);
  const active = String(product?.estatus ?? "").trim().toUpperCase();
  const unavailable = inventory <= 0 || ["NO", "INACTIVO", "INACTIVA"].includes(active);
  return `<article class="mn-product" data-product-id="${id}">
    <div class="mn-product-image-wrap">
      ${image ? `<img class="mn-product-image mn-product-image-real" src="${escapeHtml(image)}" alt="${name}" loading="lazy" decoding="async">` : `<div class="mn-product-image mn-product-image-empty">Sin imagen</div>`}
      <button class="mn-product-cart" type="button" data-add-product="${id}" aria-label="Agregar ${name} al carrito" ${unavailable ? "disabled" : ""}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20 8H6"></path><circle cx="9" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle><path d="M17 3v4M14.5 5H19.5"></path></svg>
      </button>
    </div>
    <div class="mn-product-body">
      <p class="mn-product-name">${name}</p>
      <p class="mn-product-category">${category}</p>
      <p class="mn-product-price">${price}</p>
      <p class="mn-product-stock">${unavailable ? "No disponible" : `Disponible: ${inventory}`}</p>
    </div>
  </article>`;
}
function renderCategories() {
  const container = document.getElementById("mn-category-strip");
  if (!container) return;
  const categories = buildCategories(state.products);
  container.innerHTML = [
    `<button class="mn-category-chip${state.category ? "" : " active"}" type="button" data-category="">Todas</button>`,
    ...categories.map(
      (category) => `<button class="mn-category-chip${state.category === category.value.toUpperCase() ? " active" : ""}" type="button" data-category="${escapeHtml(category.value)}">${escapeHtml(category.label)}</button>`
    )
  ].join("");
}
function renderBatch(reset = true) {
  const grid = document.querySelector(".mn-catalog-grid");
  if (!grid) return;
  if (reset) {
    state.filtered = state.products.filter(matches);
    state.rendered = 0;
    grid.innerHTML = "";
  }
  const end = Math.min(state.rendered + (state.rendered ? BATCH_SIZE : INITIAL_BATCH), state.filtered.length);
  const batch = state.filtered.slice(state.rendered, end);
  if (batch.length) grid.insertAdjacentHTML("beforeend", batch.map(createProduct).join(""));
  state.rendered = end;
  const status = document.getElementById("mn-search-status");
  if (status) {
    if (state.query || state.category) {
      status.textContent = `${state.filtered.length.toLocaleString("es-MX")} producto${state.filtered.length === 1 ? "" : "s"} encontrado${state.filtered.length === 1 ? "" : "s"}`;
    } else {
      status.textContent = `${state.products.length.toLocaleString("es-MX")} productos disponibles`;
    }
  }
  if (!state.filtered.length) {
    grid.innerHTML = '<div class="mn-empty mn-catalog-empty">No encontramos productos con esos criterios.</div>';
  }
  setupObserver();
}
function setupObserver() {
  const sentinel = document.getElementById("mn-catalog-sentinel");
  if (!sentinel) return;
  state.observer?.disconnect();
  state.observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    if (state.loadingMore || state.rendered >= state.filtered.length) return;
    state.loadingMore = true;
    requestAnimationFrame(() => {
      renderBatch(false);
      state.loadingMore = false;
    });
  }, { rootMargin: "600px 0px" });
  state.observer.observe(sentinel);
}
function updateCategory(category) {
  state.category = String(category ?? "").trim().toUpperCase();
  renderCategories();
  renderBatch(true);
}
function updateQuery(query) {
  state.query = String(query ?? "").trim().toLowerCase();
  renderBatch(true);
}
function getProductState(product) {
  return {
    name: String(product?.nombre || "Producto sin nombre"),
    category: String(product?.categoria || ""),
    price: parsePrice(product?.precio),
    inventory: Number(product?.inventario) || 0,
    status: String(product?.estatus ?? "").trim().toUpperCase(),
    image: String(product?.imagen ?? "").trim()
  };
}
function productUnavailable(product) {
  const inventory = Number(product?.inventario) || 0;
  const active = String(product?.estatus ?? "").trim().toUpperCase();
  return inventory <= 0 || ["NO", "INACTIVO", "INACTIVA"].includes(active);
}
function updateRenderedProduct(product, previousProduct = null) {
  const id = String(product?.id ?? "");
  if (!id) return;
  const article = document.querySelector(
    `.mn-product[data-product-id="${CSS.escape(id)}"]`
  );
  if (!article) return;
  const next = getProductState(product);
  const previous = previousProduct ? getProductState(previousProduct) : null;
  const nameChanged = !previous || next.name !== previous.name;
  const categoryChanged = !previous || next.category !== previous.category;
  const priceChanged = !previous || next.price !== previous.price;
  const inventoryChanged = !previous || next.inventory !== previous.inventory;
  const statusChanged = !previous || next.status !== previous.status;
  const imageChanged = !previous || next.image !== previous.image;
  if (nameChanged) {
    const name = article.querySelector(".mn-product-name");
    if (name) name.textContent = next.name;
  }
  if (categoryChanged) {
    const category = article.querySelector(".mn-product-category");
    if (category) category.textContent = next.category;
  }
  if (priceChanged) {
    const price = article.querySelector(".mn-product-price");
    if (price) price.textContent = formatPrice(next.price);
  }
  if (inventoryChanged || statusChanged) {
    const unavailable = productUnavailable(product);
    const stock = article.querySelector(".mn-product-stock");
    const button = article.querySelector("[data-add-product]");
    if (stock) {
      stock.textContent = unavailable ? "No disponible" : `Disponible: ${next.inventory}`;
    }
    if (button) {
      button.disabled = unavailable;
      button.setAttribute(
        "aria-label",
        unavailable ? `Producto no disponible: ${next.name}` : `Agregar ${next.name} al carrito`
      );
    }
  }
  if (nameChanged && !(inventoryChanged || statusChanged)) {
    const button = article.querySelector("[data-add-product]");
    if (button) {
      const unavailable = productUnavailable(product);
      button.setAttribute(
        "aria-label",
        unavailable ? `Producto no disponible: ${next.name}` : `Agregar ${next.name} al carrito`
      );
    }
  }
  if (imageChanged) {
    const wrap = article.querySelector(".mn-product-image-wrap");
    if (wrap) {
      const currentImage = wrap.querySelector(".mn-product-image");
      const image = imageUrl(next.image);
      if (image) {
        if (currentImage?.tagName === "IMG") {
          currentImage.src = image;
          currentImage.alt = next.name;
        } else {
          currentImage?.remove();
          const img = document.createElement("img");
          img.className = "mn-product-image mn-product-image-real";
          img.src = image;
          img.alt = next.name;
          img.loading = "lazy";
          img.decoding = "async";
          wrap.prepend(img);
        }
      } else if (currentImage?.tagName === "IMG") {
        currentImage.remove();
        const empty = document.createElement("div");
        empty.className = "mn-product-image mn-product-image-empty";
        empty.textContent = "Sin imagen";
        wrap.prepend(empty);
      }
    }
  }
  if (nameChanged || categoryChanged || priceChanged || inventoryChanged || statusChanged || imageChanged) {
    article.dataset.liveUpdated = String(Date.now());
  }
}
function applyCatalogRefresh(products) {
  const previousProducts = state.products;
  const previousById = new Map(
    previousProducts.map((product) => [String(product?.id ?? ""), product])
  );
  const nextById = new Map(
    products.map((product) => [String(product?.id ?? ""), product])
  );
  const changedIds = /* @__PURE__ */ new Set();
  for (const product of products) {
    const id = String(product?.id ?? "");
    if (!id) continue;
    const previous = previousById.get(id);
    if (!previous) {
      changedIds.add(id);
      continue;
    }
    const before = getProductState(previous);
    const after = getProductState(product);
    if (before.name !== after.name || before.category !== after.category || before.price !== after.price || before.inventory !== after.inventory || before.status !== after.status || before.image !== after.image) {
      changedIds.add(id);
    }
  }
  state.products = products;
  state.filtered = state.products.filter(matches);
  for (const article of document.querySelectorAll(".mn-product[data-product-id]")) {
    const id = String(article.dataset.productId || "");
    const next = nextById.get(id);
    if (!next || !matches(next)) {
      article.remove();
      continue;
    }
    if (changedIds.has(id)) {
      updateRenderedProduct(next, previousById.get(id) || null);
    }
  }
  if (changedIds.size) {
    renderCategories();
    console.info(
      "MISS NAILS \u2192 cat\xE1logo actualizado:",
      changedIds.size,
      "producto(s)"
    );
  }
  void writeCatalogCache(products).catch((error) => {
    console.warn("MISS NAILS \u2192 no se pudo guardar el cat\xE1logo local:", error);
  });
}
async function refreshInventory() {
  if (!state.products.length || state.inventoryRefreshing) return;
  state.inventoryRefreshing = true;
  try {
    const products = await fetchProducts();
    applyCatalogRefresh(products);
  } catch (error) {
    console.warn("MISS NAILS \u2192 no se pudo actualizar el cat\xE1logo:", error);
  } finally {
    state.inventoryRefreshing = false;
  }
}
function startInventoryRefresh() {
  if (state.inventoryRefreshTimer) {
    clearInterval(state.inventoryRefreshTimer);
  }
  state.inventoryRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === "hidden") return;
    refreshInventory();
  }, INVENTORY_REFRESH_MS);
}
function bindEvents() {
  const form = document.getElementById("mn-search-form");
  const input = document.getElementById("mn-search-input");
  const categories = document.getElementById("mn-category-strip");
  const grid = document.querySelector(".mn-catalog-grid");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    updateQuery(input?.value || "");
    if (location.hash !== "#catalogo") location.hash = "#catalogo";
  });
  input?.addEventListener("input", (event) => updateQuery(event.target.value));
  categories?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-category]");
    if (!chip) return;
    updateCategory(chip.dataset.category || "");
  });
  grid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-product]");
    if (!button || button.disabled) return;
    const product = state.products.find((item) => String(item?.id) === String(button.dataset.addProduct));
    if (!product) return;
    window.dispatchEvent(new CustomEvent("missnails:add-to-cart", { detail: product }));
  });
}
async function initCatalog() {
  bindEvents();
  const grid = document.querySelector(".mn-catalog-grid");
  if (!grid) return;
  grid.innerHTML = '<div class="mn-empty mn-catalog-loading">Cargando cat\xE1logo\u2026</div>';
  let catalogShownFromCache = false;
  try {
    const cachedProducts = await readCatalogCache();
    if (Array.isArray(cachedProducts) && cachedProducts.length) {
      state.products = cachedProducts;
      renderCatalogState();
      catalogShownFromCache = true;
      console.info("MISS NAILS \u2192 cat\xE1logo local inmediato:", cachedProducts.length, "productos");
    }
  } catch (error) {
    console.warn("MISS NAILS \u2192 cach\xE9 local no disponible:", error);
  }
  try {
    const products = await fetchProducts();
    if (catalogShownFromCache) {
      applyCatalogRefresh(products);
    } else {
      state.products = products;
      renderCatalogState();
      void writeCatalogCache(products).catch((error) => {
        console.warn("MISS NAILS \u2192 no se pudo guardar el cat\xE1logo local:", error);
      });
    }
    startInventoryRefresh();
    console.info("MISS NAILS \u2192 cat\xE1logo real:", products.length, "productos");
  } catch (error) {
    console.error("MISS NAILS \u2192 error cargando cat\xE1logo:", error);
    if (!catalogShownFromCache) {
      grid.innerHTML = '<div class="mn-empty mn-catalog-error">No fue posible cargar el cat\xE1logo. Intenta nuevamente.</div>';
      const status = document.getElementById("mn-search-status");
      if (status) status.textContent = "No se pudo conectar con el cat\xE1logo.";
    } else {
      const status = document.getElementById("mn-search-status");
      if (status) status.textContent = `${state.products.length.toLocaleString("es-MX")} productos disponibles \xB7 actualizaci\xF3n pendiente`;
      startInventoryRefresh();
    }
  }
}

// app/auth/auth.js
init_dist();

// node_modules/@capacitor/browser/dist/esm/index.js
init_dist();
var Browser2 = registerPlugin("Browser", {
  web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.BrowserWeb())
});

// app/auth/auth.js
var WORKER_URL = "https://miss-nails-api.ceballosgg2000.workers.dev";
async function iniciarSesionFederada(proveedor) {
  const proveedorNormalizado = String(proveedor || "").trim().toLowerCase();
  if (!["google", "microsoft"].includes(proveedorNormalizado)) {
    throw new Error("Proveedor de acceso no permitido.");
  }
  const esAndroidNativo2 = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const destino = `${WORKER_URL}/auth/${proveedorNormalizado}/start`;
  if (esAndroidNativo2) {
    await Browser2.open({ url: `${destino}?platform=android` });
    return;
  }
  window.location.assign(destino);
}
async function resolverSesion() {
  try {
    const respuesta = await fetch(
      `${WORKER_URL}/api/session`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Accept": "application/json"
        }
      }
    );
    let json = null;
    try {
      json = await respuesta.json();
    } catch {
      json = null;
    }
    if (!respuesta.ok || !json || json.ok === false || json.valida !== true) {
      return {
        autenticada: false,
        cliente: null
      };
    }
    return {
      autenticada: true,
      cliente: json.cliente || null,
      identidad: json.identidad || null,
      sesion: json.sesion || null
    };
  } catch {
    return {
      autenticada: false,
      cliente: null
    };
  }
}
async function cerrarSesion() {
  try {
    const respuesta = await fetch(
      `${WORKER_URL}/api/logout`,
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Accept": "application/json",
          "X-CSRF-Protection": "1"
        }
      }
    );
    let json = null;
    try {
      json = await respuesta.json();
    } catch {
      json = null;
    }
    return {
      ok: respuesta.ok && !!json && json.ok !== false,
      respuesta: json
    };
  } catch {
    return {
      ok: false,
      respuesta: null
    };
  }
}
async function procesarRetornoNativo(urlRecibida) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return false;
  }
  let url;
  try {
    url = new URL(urlRecibida);
  } catch {
    return false;
  }
  if (url.protocol !== "missnails:" || url.hostname !== "auth" || url.pathname !== "/callback") {
    return false;
  }
  const error = url.searchParams.get("auth_error");
  if (error) {
    window.location.replace(`/?auth_error=${encodeURIComponent(error)}`);
    return true;
  }
  const ticket = url.searchParams.get("ticket") || "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(ticket)) {
    window.location.replace("/?auth_error=ERROR_AUTENTICACION");
    return true;
  }
  try {
    const respuesta = await fetch(`${WORKER_URL}/auth/native/exchange`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ticket })
    });
    const resultado = await respuesta.json().catch(() => null);
    if (!respuesta.ok || !resultado || resultado.ok !== true) {
      window.location.replace("/?auth_error=ERROR_AUTENTICACION");
      return true;
    }
    window.location.replace("/?auth=ok");
    return true;
  } catch {
    window.location.replace("/?auth_error=ERROR_AUTENTICACION");
    return true;
  }
}

// app/app.js
init_dist();

// node_modules/@capacitor/app/dist/esm/index.js
init_dist();
var App = registerPlugin("App", {
  web: () => Promise.resolve().then(() => (init_web2(), web_exports2)).then((m) => new m.AppWeb())
});

// app/auth/login.js
var ERRORES_AUTENTICACION = {
  AUTENTICACION_CANCELADA: "El acceso fue cancelado.",
  STATE_INVALIDO: "La solicitud de acceso no pudo validarse. Int\xE9ntalo nuevamente.",
  TRANSACCION_INVALIDA: "La solicitud de acceso ya no es v\xE1lida. Int\xE9ntalo nuevamente.",
  TRANSACCION_EXPIRADA: "La solicitud de acceso expir\xF3. Int\xE9ntalo nuevamente.",
  IDENTIDAD_NO_VINCULADA: "Esta cuenta no est\xE1 vinculada a un cliente autorizado de MISS NAILS.",
  IDENTIDAD_DESACTIVADA: "Esta identidad de acceso est\xE1 desactivada.",
  CLIENTE_DESACTIVADO: "El acceso de este cliente est\xE1 desactivado.",
  CLIENTE_NO_ENCONTRADO: "No existe un cliente autorizado para esta identidad.",
  ERROR_AUTENTICACION: "No fue posible completar el acceso. Int\xE9ntalo nuevamente."
};
function mensajeErrorDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("auth_error");
  if (!codigo) return "";
  const mensaje = ERRORES_AUTENTICACION[codigo] || "No fue posible completar el acceso. Int\xE9ntalo nuevamente.";
  params.delete("auth_error");
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, url);
  return mensaje;
}
function initLogin({ onAuthenticated }) {
  const screen = document.querySelector("#mn-login");
  const google = document.querySelector("#mn-login-google");
  const microsoft = document.querySelector("#mn-login-microsoft");
  const message = document.querySelector("#mn-login-message");
  const status = document.querySelector("#mn-login-status");
  if (!screen || !google || !microsoft || !message || !status) {
    throw new Error("MISS NAILS: estructura de acceso federado incompleta.");
  }
  function mostrarMensaje(texto) {
    message.textContent = texto || "";
    message.hidden = !texto;
  }
  function bloquear(bloqueado, texto = "") {
    google.disabled = bloqueado;
    microsoft.disabled = bloqueado;
    google.setAttribute("aria-busy", String(bloqueado));
    microsoft.setAttribute("aria-busy", String(bloqueado));
    status.textContent = texto || "Selecciona un proveedor para continuar.";
  }
  async function entrar(proveedor, boton) {
    mostrarMensaje("");
    bloquear(true, "Conectando con el proveedor\u2026");
    boton.focus();
    try {
      await iniciarSesionFederada(proveedor);
    } catch (error) {
      mostrarMensaje(error.message || "No fue posible iniciar el acceso.");
      bloquear(false);
    }
  }
  google.addEventListener("click", () => entrar("google", google));
  microsoft.addEventListener("click", () => entrar("microsoft", microsoft));
  return {
    show() {
      screen.hidden = false;
      bloquear(false);
      const error = mensajeErrorDesdeURL();
      mostrarMensaje(error);
      if (!error) google.focus();
    },
    hide() {
      screen.hidden = true;
      mostrarMensaje("");
    },
    showError(texto) {
      mostrarMensaje(texto);
    },
    onAuthenticated
  };
}

// app/app.js
var app = document.querySelector(".mn-app");
var loginScreen = document.querySelector("#mn-login");
if (!app || !loginScreen) {
  throw new Error("MISS NAILS: estructura principal incompleta.");
}
applyRuntimeContext(app);
var esAndroidNativo = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
var retornoNativoPromise = null;
function procesarUrlNativa(url) {
  if (!url) {
    return Promise.resolve(false);
  }
  if (retornoNativoPromise) {
    return retornoNativoPromise;
  }
  retornoNativoPromise = procesarRetornoNativo(url).then((procesado) => {
    if (!procesado) {
      retornoNativoPromise = null;
    }
    return procesado;
  }).catch(() => {
    retornoNativoPromise = null;
    return false;
  });
  return retornoNativoPromise;
}
var urlInicialNativa = Promise.resolve(null);
if (esAndroidNativo) {
  void App.addListener("appUrlOpen", ({ url }) => {
    void procesarUrlNativa(url);
  }).catch(() => {
  });
  urlInicialNativa = App.getLaunchUrl().then((launch) => launch?.url || null).catch(() => null);
}
var router = createRouter(app);
var login = initLogin({
  onAuthenticated: () => mostrarAplicacion()
});
var catalogoInicializado = false;
function mostrarAplicacion(estadoSesion = null) {
  login.hide();
  app.hidden = false;
  document.body.classList.remove("mn-auth-required");
  location.hash = "#catalogo";
  router.renderView();
  if (!catalogoInicializado) {
    catalogoInicializado = true;
    initCatalog();
  }
  void actualizarCuenta(estadoSesion);
}
function mostrarLogin() {
  app.hidden = true;
  document.body.classList.add("mn-auth-required");
  login.show();
}
async function actualizarCuenta(estadoSesion = null) {
  const estado = estadoSesion || await resolverSesion();
  if (!estado.autenticada) {
    return;
  }
  const cliente = estado.cliente || {};
  const nombre = document.querySelector(".profile-copy h2");
  const correo = document.querySelector(".profile-copy p");
  const avatar = document.querySelector(".avatar");
  if (nombre) {
    nombre.textContent = cliente.nombre || "Cliente MISS NAILS";
  }
  if (correo) {
    correo.textContent = cliente.correo || "";
  }
  if (avatar) {
    avatar.textContent = iniciales(
      cliente.nombre || cliente.correo || "MN"
    );
  }
}
function iniciales(texto) {
  const partes = String(texto).trim().split(/\s+/).filter(Boolean);
  if (!partes.length) {
    return "MN";
  }
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
document.querySelector(".logout")?.addEventListener(
  "click",
  async () => {
    await cerrarSesion();
    mostrarLogin();
  }
);
async function iniciarAplicacion() {
  if (esAndroidNativo) {
    const urlInicial = await urlInicialNativa;
    if (urlInicial) {
      const procesado = await procesarUrlNativa(urlInicial);
      if (procesado) {
        return;
      }
    }
    if (retornoNativoPromise) {
      const procesado = await retornoNativoPromise;
      if (procesado) {
        return;
      }
    }
  }
  const estado = await resolverSesion();
  if (esAndroidNativo && retornoNativoPromise) {
    const procesado = await retornoNativoPromise;
    if (procesado) {
      return;
    }
  }
  if (estado.autenticada) {
    mostrarAplicacion(estado);
  } else {
    mostrarLogin();
  }
}
void iniciarAplicacion();
var frame = 0;
function refreshContext() {
  if (frame || app.hidden) {
    return;
  }
  frame = requestAnimationFrame(() => {
    frame = 0;
    updateDynamicContext(app);
  });
}
window.addEventListener("resize", refreshContext, { passive: true });
window.addEventListener(
  "orientationchange",
  refreshContext,
  { passive: true }
);
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
