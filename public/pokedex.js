const pokedexEl = document.getElementById("pokedex");

function centavosAMonto(centavos) {
  return `$${(centavos / 100).toFixed(2)}`;
}

function rarezaSlug(rareza) {
  return rareza.replace(/\s+/g, "-");
}

async function cargarPokedex() {
  const res = await fetch("/api/pokedex");
  const items = await res.json();

  pokedexEl.innerHTML = "";
  if (items.length === 0) {
    pokedexEl.textContent = "Todavia no tienes cartas. Compra un sobre para empezar tu coleccion.";
    return;
  }

  for (const carta of items) {
    const div = document.createElement("div");
    div.className = `carta rareza-${rarezaSlug(carta.rareza)}`;
    div.innerHTML = `
      <img src="${carta.imagen}" alt="${carta.nombre}" />
      <div class="nombre">#${carta.id} ${carta.nombre}</div>
      <div class="rareza">${carta.rareza} — ${centavosAMonto(carta.precioCentavos)}</div>
      <div class="origen">via ${carta.origen}</div>
    `;
    pokedexEl.appendChild(div);
  }
}

(async () => {
  const usuario = await initNav();
  if (usuario) cargarPokedex();
})();
