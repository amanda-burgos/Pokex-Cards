const listaEl = document.getElementById("chat-lista");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("chat-input");
const enviarBtn = document.getElementById("chat-enviar");
const bandejaEl = document.getElementById("chat-bandeja");
const bandejaInfoEl = document.getElementById("chat-bandeja-info");
const bandejaComprarBtn = document.getElementById("chat-bandeja-comprar");
const bandejaLimpiarBtn = document.getElementById("chat-bandeja-limpiar");

// Tools cuyas cartas se pueden seleccionar para armar un sobre directo desde
// el chat (a diferencia de listar_pokedex/listar_inventario, que son solo
// informativas y mandan un mensaje directo al hacer click).
const TOOLS_SELECCIONABLES = new Set(["buscar_catalogo", "cotizar_cartas"]);
const MAX_SELECCION = 3;
const seleccion = new Map();

const STARTERS = [
  "¿Que cartas legendarias hay en el catalogo?",
  "Quiero comprar un sobre sorpresa",
  "¿Cuanto saldo tengo?",
  "Muestrame mi inventario",
];

function centavosAMonto(centavos) {
  return `$${(centavos / 100).toFixed(2)}`;
}

function agregarBurbuja(rol, texto) {
  const div = document.createElement("div");
  div.className = `burbuja burbuja-${rol}`;
  div.textContent = texto;
  listaEl.appendChild(div);
  listaEl.scrollTop = listaEl.scrollHeight;
  return div;
}

function agregarBienvenida() {
  agregarBurbuja(
    "asistente",
    "¡Hola, entrenador! Soy tu asistente de Entrenador Pokemon. Puedo ayudarte a buscar cartas, comprar sobres, revisar tu Pokedex o inventario, vender cartas y mas. ¿En que te ayudo?"
  );

  const chips = document.createElement("div");
  chips.className = "chat-starters";
  for (const texto of STARTERS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = texto;
    btn.addEventListener("click", () => enviarMensaje(texto));
    chips.appendChild(btn);
  }
  listaEl.appendChild(chips);
}

function actualizarBandeja() {
  if (seleccion.size === 0) {
    bandejaEl.hidden = true;
    return;
  }
  bandejaEl.hidden = false;
  const total = [...seleccion.values()].reduce((sum, c) => sum + c.precioCentavos, 0);
  bandejaInfoEl.textContent = `Seleccionadas: ${seleccion.size} / ${MAX_SELECCION} — Total: ${centavosAMonto(total)}`;
  bandejaComprarBtn.disabled = seleccion.size !== MAX_SELECCION;
}

function limpiarSeleccion() {
  seleccion.clear();
  listaEl
    .querySelectorAll(".carta.seleccionada")
    .forEach((el) => el.classList.remove("seleccionada"));
  actualizarBandeja();
}

function alternarSeleccion(carta, div) {
  if (seleccion.has(carta.id)) {
    seleccion.delete(carta.id);
    div.classList.remove("seleccionada");
  } else {
    if (seleccion.size >= MAX_SELECCION) return;
    seleccion.set(carta.id, carta);
    div.classList.add("seleccionada");
  }
  actualizarBandeja();
}

function tarjetasDesdeCartas(cartas, seleccionable) {
  const grid = document.createElement("div");
  grid.className = "grid chat-grid";
  for (const carta of cartas) {
    if (!carta || !carta.id) continue;
    const div = document.createElement("div");
    div.className = "carta";
    if (seleccionable && seleccion.has(carta.id)) div.classList.add("seleccionada");
    div.innerHTML = `
      <img src="${carta.imagen}" alt="${carta.nombre}" />
      <div class="nombre">#${carta.id} ${carta.nombre}</div>
      <div class="rareza">${carta.rareza} — ${centavosAMonto(carta.precioCentavos)}</div>
    `;
    if (seleccionable) {
      div.addEventListener("click", () => alternarSeleccion(carta, div));
    } else {
      div.addEventListener("click", () =>
        enviarMensaje(`Quiero la carta #${carta.id} (${carta.nombre})`)
      );
    }
    grid.appendChild(div);
  }
  return grid;
}

bandejaComprarBtn.addEventListener("click", () => {
  const cartas = [...seleccion.values()];
  const detalle = cartas.map((c) => `#${c.id} ${c.nombre}`).join(", ");
  limpiarSeleccion();
  enviarMensaje(`Quiero comprar el sobre directo con estas cartas: ${detalle}`);
});

bandejaLimpiarBtn.addEventListener("click", limpiarSeleccion);

function botonDePago(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.className = "chat-boton-pago";
  a.textContent = "Pagar con Stripe";
  return a;
}

function renderizarEventos(eventos) {
  for (const evento of eventos) {
    const salida = evento.output;
    if (!salida || typeof salida !== "object") continue;
    const seleccionable = TOOLS_SELECCIONABLES.has(evento.tool);

    if (Array.isArray(salida) && salida.length && salida[0]?.id) {
      listaEl.appendChild(tarjetasDesdeCartas(salida, seleccionable));
    } else if (Array.isArray(salida.resultados) && salida.resultados.length) {
      listaEl.appendChild(tarjetasDesdeCartas(salida.resultados, seleccionable));
    } else if (Array.isArray(salida.cartas) && salida.cartas.length) {
      listaEl.appendChild(tarjetasDesdeCartas(salida.cartas, seleccionable));
    }

    if (salida.url) {
      listaEl.appendChild(botonDePago(salida.url));
    }
  }
  listaEl.scrollTop = listaEl.scrollHeight;
}

async function enviarMensaje(mensaje) {
  inputEl.value = "";
  enviarBtn.disabled = true;
  agregarBurbuja("usuario", mensaje);
  const pensando = agregarBurbuja("asistente", "Pensando...");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje }),
    });
    const data = await res.json();
    pensando.remove();

    if (!res.ok) {
      agregarBurbuja("asistente", data.error || "Ocurrio un error, intenta de nuevo.");
      return;
    }

    agregarBurbuja("asistente", data.respuesta);
    if (data.eventos?.length) renderizarEventos(data.eventos);
  } catch (err) {
    pensando.remove();
    agregarBurbuja("asistente", "No se pudo conectar con el asistente.");
  } finally {
    enviarBtn.disabled = false;
    inputEl.focus();
  }
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const mensaje = inputEl.value.trim();
  if (mensaje) enviarMensaje(mensaje);
});

(async () => {
  const usuario = await initNav();
  if (!usuario) return;
  await fetch("/api/chat/reiniciar", { method: "POST" });
  agregarBienvenida();
})();
