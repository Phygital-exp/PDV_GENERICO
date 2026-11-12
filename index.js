const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const app = express();

const PORT = process.env.PORT || 3000;
const { API_TOKEN } = process.env;
const PDV_ENDPOINT_URL = "https://botai.smartdataautomation.com/api_backend_ai/dinamic-db/report/119/pdv_genericos";

// Clientes permitidos (agregar aquí nuevos clientes)
const CLIENTES = ["BUCANEROS", "CARVAL"];

if (!API_TOKEN) {
    console.error("❌ Falta la variable de entorno API_TOKEN");
    process.exit(1);
}

const AUTH_HEADERS = {
    Authorization: `Token ${API_TOKEN}`,
    "Content-Type": "application/json",
};

app.use(cors());

// Lista de clientes para el selector del front
app.get("/api/genericos/clientes", (req, res) => {
    res.json(CLIENTES);
});

// PDVs filtrados por cliente: /api/genericos/pdv?cliente=BUCANEROS
app.get("/api/genericos/pdv", async (req, res) => {
    const cliente = String(req.query.cliente || "").trim().toUpperCase();

    if (!cliente) {
        return res.status(400).json({ error: "Debe indicar el parámetro 'cliente'" });
    }
    if (!CLIENTES.includes(cliente)) {
        return res.status(400).json({ error: `Cliente no válido: ${cliente}` });
    }

    const url = `${PDV_ENDPOINT_URL}?CLIENTE=${encodeURIComponent(cliente)}`;

    try {
        const response = await fetch(url, { headers: AUTH_HEADERS });

        // Si el backend responde 404 lo tratamos como "sin puntos de venta"
        if (response.status === 404) {
            return res.json([]);
        }

        if (!response.ok) {
            const text = await response.text();
            console.error(`❌ Error HTTP ${response.status}:`, text);
            return res.status(response.status).json({ error: `Error ${response.status}: ${text.substring(0, 200)}` });
        }

        const data = await response.json();
        res.json(data ?? []);
    } catch (err) {
        console.error("❌ Error en el proxy:", err);
        res.status(500).json({ error: "Error al obtener datos del PDV", details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor proxy escuchando en http://localhost:${PORT}`);
});
