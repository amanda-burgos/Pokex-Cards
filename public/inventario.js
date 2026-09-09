const CANTIDAD_A_RECLAMAR = 3;
const seleccionados = new Set();

const inventarioEl = document.getElementById("inventario");
const infoEl = document.getElementById("seleccion-info");
const mensajeEl = document.getElementById("mensaje");
const reclamarBtn = document.getElementById("reclamar");

function centavosAMonto(centavos) {
  return `$${(centavos / 100).toFixed(2)}`;
}

function rarezaSlug(rareza) {
  return rareza.replace(/\s+/g, "-");
}

function actualizarInfo() {
  infoEl.textContent = `Seleccionadas para reclamar: ${seleccionados.size} / ${CANTIDAD_A_RECLAMAR}`;
  reclamarBtn.disabled = seleccionados.size !== CANTIDAD_A_RECLAMAR;
}

function toggleSeleccion(inventarioId, cardEl) {
  if (seleccionados.has(inventarioId)) {
    seleccionados.delete(inventarioId);
    cardEl.classList.remove("seleccionada");
  } else {
    if (seleccionados.size >= CANTIDAD_A_RECLAMAR) {
      mensajeEl.textContent = `Solo puedes reclamar ${CANTIDAD_A_RECLAMAR} a la vez`;
      return;
    }
    seleccionados.add(inventarioId);
    cardEl.classList.add("seleccionada");
  }
  mensajeEl.textContent = "";
  actualizarInfo();
}

async function venderCarta(inventarioId) {
  const res = await fetch("/api/inventario/vender", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inventarioId }),
  });
  const data = await res.json();

  if (!res.ok) {
    mensajeEl.textContent = data.error;
    return;
  }

  mensajeEl.textContent = `Vendida por ${centavosAMonto(data.saldoSumado)} de saldo.`;
  seleccionados.delete(inventarioId);
  await cargarInventario();
  await initNav();
}

async function cargarInventario() {
  const res = await fetch("/api/inventario");
  const items = await res.json();

  inventarioEl.innerHTML = "";
  if (items.length === 0) {
    inventarioEl.textContent = "Tu inventario esta vacio. Compra un Sobre Sorpresa para llenarlo.";
  }

  for (const carta of items) {
    const div = document.createElement("div");
    div.className = `carta rareza-${rarezaSlug(carta.rareza)}`;
    if (seleccionados.has(carta.inventarioId)) div.classList.add("seleccionada");
    div.innerHTML = `
      <img src="${carta.imagen}" alt="${carta.nombre}" />
      <div class="nombre">#${carta.id} ${carta.nombre}</div>
      <div class="rareza">${carta.rareza} — ${centavosAMonto(carta.precioCentavos)}</div>
      <button class="vender-btn">Vender</button>
    `;
    div.addEventListener("click", () => toggleSeleccion(carta.inventarioId, div));
    div.querySelector(".vender-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      venderCarta(carta.inventarioId);
    });
    inventarioEl.appendChild(div);
  }

  actualizarInfo();
}

reclamarBtn.addEventListener("click", async () => {
  mensajeEl.textContent = "";
  const res = await fetch("/api/inventario/reclamar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inventarioIds: [...seleccionados] }),
  });
  const data = await res.json();

  if (!res.ok) {
    mensajeEl.textContent = data.error;
    return;
  }

  mensajeEl.textContent = "Cartas reclamadas en tu Pokedex.";
  seleccionados.clear();
  await cargarInventario();
});

(async () => {
  const usuario = await initNav();
  if (usuario) cargarInventario();
})();
