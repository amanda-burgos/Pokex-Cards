const TAMANO_SOBRE = 3;
const seleccionados = new Map(); // id -> carta (para calcular el total entre paginas)

const catalogoEl = document.getElementById("catalogo");
const infoEl = document.getElementById("seleccion-info");
const mensajeEl = document.getElementById("mensaje");
const comprarBtn = document.getElementById("comprar");
const buscadorEl = document.getElementById("buscador");
const filtroRarezaEl = document.getElementById("filtro-rareza");
const paginaInfoEl = document.getElementById("pagina-info");
const paginaAnteriorBtn = document.getElementById("pagina-anterior");
const paginaSiguienteBtn = document.getElementById("pagina-siguiente");

let pagina = 1;
let totalPaginas = 1;
let busqueda = "";
let rarezaFiltro = "";

function centavosAMonto(centavos) {
  return `$${(centavos / 100).toFixed(2)}`;
}

function rarezaSlug(rareza) {
  return rareza.replace(/\s+/g, "-");
}

async function cargarRarezas() {
  const res = await fetch("/api/catalog/rarezas");
  const rarezas = await res.json();
  for (const r of rarezas) {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    filtroRarezaEl.appendChild(opt);
  }
}

function actualizarInfo() {
  const total = [...seleccionados.values()].reduce((sum, c) => sum + c.precioCentavos, 0);
  infoEl.textContent = `Seleccionadas: ${seleccionados.size} / ${TAMANO_SOBRE} — Total: ${centavosAMonto(total)}`;
  comprarBtn.disabled = seleccionados.size !== TAMANO_SOBRE;
}

function toggleSeleccion(carta, cardEl) {
  if (seleccionados.has(carta.id)) {
    seleccionados.delete(carta.id);
    cardEl.classList.remove("seleccionada");
  } else {
    if (seleccionados.size >= TAMANO_SOBRE) {
      mensajeEl.textContent = `Solo puedes elegir ${TAMANO_SOBRE} cartas`;
      return;
    }
    seleccionados.set(carta.id, carta);
    cardEl.classList.add("seleccionada");
  }
  mensajeEl.textContent = "";
  actualizarInfo();
}

async function cargarCatalogo() {
  if (rarezaFiltro) {
    catalogoEl.innerHTML = "";
    catalogoEl.textContent = "Cargando... (la primera vez que filtras por rareza puede tardar unos segundos)";
  }

  const params = new URLSearchParams({ page: pagina, search: busqueda, rareza: rarezaFiltro });
  const res = await fetch(`/api/catalog?${params}`);
  const data = await res.json();

  totalPaginas = Math.max(1, Math.ceil(data.total / data.pageSize));
  paginaInfoEl.textContent = `Pagina ${pagina} / ${totalPaginas} (${data.total} pokemon)`;
  paginaAnteriorBtn.disabled = pagina <= 1;
  paginaSiguienteBtn.disabled = pagina >= totalPaginas;

  catalogoEl.innerHTML = "";
  for (const carta of data.resultados) {
    const div = document.createElement("div");
    div.className = `carta rareza-${rarezaSlug(carta.rareza)}`;
    if (seleccionados.has(carta.id)) div.classList.add("seleccionada");
    div.innerHTML = `
      <img src="${carta.imagen}" alt="${carta.nombre}" />
      <div class="nombre">#${carta.id} ${carta.nombre}</div>
      <div class="rareza">${carta.rareza} — ${centavosAMonto(carta.precioCentavos)}</div>
    `;
    div.addEventListener("click", () => toggleSeleccion(carta, div));
    catalogoEl.appendChild(div);
  }
}

buscadorEl.addEventListener("input", () => {
  busqueda = buscadorEl.value;
  pagina = 1;
  cargarCatalogo();
});

filtroRarezaEl.addEventListener("change", () => {
  rarezaFiltro = filtroRarezaEl.value;
  pagina = 1;
  cargarCatalogo();
});

paginaAnteriorBtn.addEventListener("click", () => {
  if (pagina > 1) {
    pagina -= 1;
    cargarCatalogo();
  }
});

paginaSiguienteBtn.addEventListener("click", () => {
  if (pagina < totalPaginas) {
    pagina += 1;
    cargarCatalogo();
  }
});

comprarBtn.addEventListener("click", async () => {
  comprarBtn.disabled = true;
  mensajeEl.textContent = "";

  try {
    const res = await fetch("/api/sobre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pokemonIds: [...seleccionados.keys()] }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Error al crear el sobre");

    window.location.href = data.pagadoConSaldo
      ? `/success.html?sobre=${data.sobreId}`
      : data.url;
  } catch (err) {
    mensajeEl.textContent = err.message;
    comprarBtn.disabled = false;
  }
});

(async () => {
  const usuario = await initNav();
  if (usuario) {
    cargarRarezas();
    cargarCatalogo();
  }
})();
