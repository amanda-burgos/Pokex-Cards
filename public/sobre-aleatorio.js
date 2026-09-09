const precioInfoEl = document.getElementById("precio-info");
const totalInfoEl = document.getElementById("total-info");
const mensajeEl = document.getElementById("mensaje");
const comprarBtn = document.getElementById("comprar");
const cantidadEl = document.getElementById("cantidad");

let precioCentavos = 0;
let maxCantidad = 10;

function centavosAMonto(centavos) {
  return `$${(centavos / 100).toFixed(2)}`;
}

function actualizarTotal() {
  const cantidad = Number(cantidadEl.value) || 1;
  totalInfoEl.textContent = `Total: ${centavosAMonto(precioCentavos * cantidad)}`;
}

async function cargarPrecio() {
  const res = await fetch("/api/sobre-aleatorio/precio");
  const data = await res.json();
  precioCentavos = data.precioCentavos;
  maxCantidad = data.maxCantidad;
  cantidadEl.max = maxCantidad;
  precioInfoEl.textContent = `Precio por sobre: ${centavosAMonto(precioCentavos)} (max ${maxCantidad} por compra)`;
  actualizarTotal();
}

cantidadEl.addEventListener("input", actualizarTotal);

comprarBtn.addEventListener("click", async () => {
  comprarBtn.disabled = true;
  mensajeEl.textContent = "";

  const cantidad = Number(cantidadEl.value) || 1;

  try {
    const res = await fetch("/api/sobre-aleatorio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Error al comprar el sobre");

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
  if (usuario) cargarPrecio();
})();
