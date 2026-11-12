// ------------------------------------
// CONFIGURACIÓN
// ------------------------------------
// URL pública del proxy en Railway
const PROXY_URL = "https://pdvgenerico-production.up.railway.app";
const PDV_URL = `${PROXY_URL}/api/genericos/pdv`;
const MAX_RESULTS = 20;

// Posibles nombres de columna para cada campo (se buscan sin importar mayúsculas)
const FIELD_MAP = {
    nombre: ["NOMBRE_PDV", "NOMBRE", "PDV", "RAZON_SOCIAL", "NOMBRE_ESTABLECIMIENTO"],
    codigo: ["SAP", "CODIGO_PDV", "CODIGO", "COD_PDV", "ID_PDV"],
    direccion: ["DIRECCION", "DIRECCION_PDV", "DIR"],
    barrio: ["BARRIO"],
    ciudad: ["CIUDAD", "MUNICIPIO"],
    departamento: ["DEPARTAMENTO", "DEPTO"],
    telefono: ["TELEFONO", "CELULAR", "TEL"],
    latitud: ["LATITUD", "LAT"],
    longitud: ["LONGITUD", "LNG", "LON"],
};

let pdvs = [];
let fuse = null;
let clienteActual = "";

// ------------------------------------
// UTILIDADES
// ------------------------------------
function getField(row, keys) {
    const lowerMap = {};
    for (const k of Object.keys(row)) lowerMap[k.toLowerCase()] = row[k];
    for (const key of keys) {
        const value = lowerMap[key.toLowerCase()];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return String(value).trim();
        }
    }
    return "";
}

function mapPdv(row) {
    const pdv = {};
    for (const [campo, keys] of Object.entries(FIELD_MAP)) {
        pdv[campo] = getField(row, keys);
    }
    return pdv;
}

// El backend puede devolver un arreglo o un objeto que lo contiene
function extractRows(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
        for (const key of ["result", "data", "results", "rows", "items"]) {
            if (Array.isArray(data[key])) return data[key];
        }
    }
    return [];
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function setStatus(html, type = "") {
    const status = document.getElementById("status");
    status.className = `status ${type}`.trim();
    status.innerHTML = html;
}

// ------------------------------------
// CARGA DE PDVs POR CLIENTE
// ------------------------------------
async function handleClienteChange() {
    const cliente = document.getElementById("clienteSelect").value;
    const searchInput = document.getElementById("searchInput");
    const results = document.getElementById("results");

    clienteActual = cliente;
    pdvs = [];
    fuse = null;
    results.innerHTML = "";
    searchInput.value = "";
    searchInput.disabled = true;
    searchInput.placeholder = "Cargando PDVs...";
    document.getElementById("searchTitle").textContent = `Búsqueda PDVs ${cliente}`;
    setStatus("Cargando puntos de venta...");

    try {
        const response = await fetch(`${PDV_URL}?cliente=${encodeURIComponent(cliente)}`);
        const data = await response.json().catch(() => null);

        // Si el usuario cambió de cliente mientras cargaba, ignorar esta respuesta
        if (cliente !== clienteActual) return;

        if (!response.ok) {
            throw new Error((data && data.error) || `Error ${response.status}`);
        }

        pdvs = extractRows(data).map(mapPdv);

        if (pdvs.length === 0) {
            searchInput.placeholder = "Sin puntos de venta";
            setStatus(
                `<span class="material-icons">info</span>De momento no hay puntos de venta para <strong>${escapeHtml(cliente)}</strong>.`,
                "empty"
            );
            return;
        }

        fuse = new Fuse(pdvs, {
            keys: [
                { name: "nombre", weight: 0.4 },
                { name: "codigo", weight: 0.2 },
                { name: "direccion", weight: 0.2 },
                { name: "barrio", weight: 0.1 },
                { name: "ciudad", weight: 0.1 },
            ],
            threshold: 0.35,
            ignoreLocation: true,
        });

        searchInput.disabled = false;
        searchInput.placeholder = "Buscar por nombre, código, dirección o ciudad...";
        searchInput.focus();
        setStatus(`${pdvs.length} puntos de venta cargados para <strong>${escapeHtml(cliente)}</strong>.`);
    } catch (err) {
        if (cliente !== clienteActual) return;
        console.error("❌ Error cargando PDVs:", err);
        searchInput.placeholder = "No se pudieron cargar los PDVs";
        setStatus(
            `<span class="material-icons">error_outline</span>No se pudieron cargar los puntos de venta. Intente de nuevo más tarde.`,
            "error"
        );
    }
}

// ------------------------------------
// BÚSQUEDA
// ------------------------------------
function handleInput() {
    const query = document.getElementById("searchInput").value.trim();
    const results = document.getElementById("results");

    if (!fuse || query.length < 2) {
        results.innerHTML = "";
        return;
    }

    const found = fuse.search(query, { limit: MAX_RESULTS }).map(r => r.item);

    if (found.length === 0) {
        results.innerHTML = `<div class="status empty">No se encontraron resultados para "${escapeHtml(query)}".</div>`;
        return;
    }

    results.innerHTML = found.map(renderPdv).join("");
}

function renderPdv(pdv, index) {
    const lugar = [pdv.barrio, pdv.ciudad, pdv.departamento].filter(Boolean).join(", ");

    const copyIcon = text =>
        `<span class="material-icons copy-icon" title="Copiar" data-copy="${escapeHtml(text)}" onclick="copyText(this)">content_copy</span>`;

    const items = [];
    if (pdv.codigo) items.push(`<li><span class="material-icons icon-tipo">tag</span><strong>SAP:</strong> ${escapeHtml(pdv.codigo)}${copyIcon(pdv.codigo)}</li>`);
    if (pdv.direccion) items.push(`<li><span class="material-icons icon-tipo">place</span><strong>Dirección:</strong> ${escapeHtml(pdv.direccion)}${copyIcon(pdv.direccion)}</li>`);
    if (lugar) items.push(`<li><span class="material-icons icon-tipo">location_city</span>${escapeHtml(lugar)}</li>`);
    if (pdv.telefono) items.push(`<li><span class="material-icons icon-tipo">phone</span>${escapeHtml(pdv.telefono)}${copyIcon(pdv.telefono)}</li>`);

    return `
        <div class="result-item pdv" style="animation-delay: ${index * 0.03}s">
            <h3><span class="material-icons icon-tipo">storefront</span>${escapeHtml(pdv.nombre || "PDV sin nombre")}</h3>
            <div class="tags"><span class="tag">${escapeHtml(clienteActual)}</span></div>
            <ul>${items.join("")}</ul>
        </div>`;
}

function copyText(el) {
    const text = el.dataset.copy;
    navigator.clipboard.writeText(text).then(() => {
        el.textContent = "check";
        setTimeout(() => { el.textContent = "content_copy"; }, 1200);
    }).catch(err => console.error("No se pudo copiar:", err));
}

// ------------------------------------
// MODO OSCURO
// ------------------------------------
function toggleDarkMode() {
    const enabled = document.getElementById("darkModeToggle").checked;
    document.body.classList.toggle("dark-mode", enabled);
    document.getElementById("darkModeLabel").textContent = enabled ? "☀️ Modo claro" : "🌙 Modo oscuro";
    try { localStorage.setItem("darkMode", enabled ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
}

(function initDarkMode() {
    let saved = null;
    try { saved = localStorage.getItem("darkMode"); } catch (e) { /* sin almacenamiento */ }
    if (saved === "1") {
        document.getElementById("darkModeToggle").checked = true;
        toggleDarkMode();
    }
})();
