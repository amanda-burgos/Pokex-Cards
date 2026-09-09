import { obtenerDetalleCacheado, guardarDetalleCache } from "./db.js";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// Precios en centavos segun rareza. Rareza derivada de base_experience
// (PokeAPI no tiene precios; esto es una regla nuestra para el ejercicio).
const TIERS = [
  { max: 64, nombre: "comun", precioCentavos: 50 },
  { max: 119, nombre: "poco comun", precioCentavos: 150 },
  { max: 179, nombre: "rara", precioCentavos: 350 },
  { max: 249, nombre: "muy rara", precioCentavos: 700 },
  { max: Infinity, nombre: "legendaria", precioCentavos: 1500 },
];

function tierPara(baseExperience) {
  return TIERS.find((t) => baseExperience <= t.max);
}

let listaCompletaCache = null;

async function obtenerListaCompleta() {
  if (listaCompletaCache) return listaCompletaCache;

  const primeraRes = await fetch(`${POKEAPI_BASE}/pokemon?limit=1`);
  if (!primeraRes.ok) throw new Error("No se pudo consultar PokeAPI");
  const primera = await primeraRes.json();

  const listaRes = await fetch(`${POKEAPI_BASE}/pokemon?limit=${primera.count}`);
  const lista = await listaRes.json();

  listaCompletaCache = lista.results.map((p) => {
    const partes = p.url.split("/").filter(Boolean);
    return { id: Number(partes[partes.length - 1]), nombre: p.name };
  });

  return listaCompletaCache;
}

async function obtenerDetalle(id) {
  const cacheado = obtenerDetalleCacheado(id);
  if (cacheado) return cacheado;

  const res = await fetch(`${POKEAPI_BASE}/pokemon/${id}`);
  if (!res.ok) throw new Error(`Pokemon con id ${id} no existe`);
  const data = await res.json();
  const tier = tierPara(data.base_experience ?? 0);

  const detalle = {
    id: data.id,
    nombre: data.name,
    imagen: data.sprites?.front_default,
    rareza: tier.nombre,
    precioCentavos: tier.precioCentavos,
  };

  guardarDetalleCache(detalle);
  return detalle;
}

async function mapConcurrencia(items, limite, fn) {
  const resultados = new Array(items.length);
  let indice = 0;

  async function trabajador() {
    while (indice < items.length) {
      const i = indice++;
      resultados[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
  return resultados;
}

export async function buscarCatalogo({ search = "", page = 1, pageSize = 24, rareza = "" }) {
  const lista = await obtenerListaCompleta();
  const termino = search.trim().toLowerCase();

  const candidatos = termino
    ? lista.filter(
        (p) => p.nombre.includes(termino) || String(p.id) === termino
      )
    : lista;

  if (rareza) {
    // Para filtrar por rareza necesitamos el detalle (base_experience) de cada
    // candidato; se cachea en SQLite asi que solo es lento la primera vez.
    const detalles = await mapConcurrencia(candidatos, 20, (p) => obtenerDetalle(p.id));
    const filtrados = detalles.filter((d) => d.rareza === rareza);

    const total = filtrados.length;
    const inicio = (page - 1) * pageSize;
    const resultados = filtrados.slice(inicio, inicio + pageSize);

    return { total, page, pageSize, resultados };
  }

  const total = candidatos.length;
  const inicio = (page - 1) * pageSize;
  const pagina = candidatos.slice(inicio, inicio + pageSize);

  const resultados = await Promise.all(pagina.map((p) => obtenerDetalle(p.id)));

  return { total, page, pageSize, resultados };
}

export const RAREZAS = TIERS.map((t) => t.nombre);

export async function obtenerCartasPorId(ids) {
  return Promise.all(ids.map((id) => obtenerDetalle(id)));
}

export async function elegirAleatorios(cantidad) {
  const lista = await obtenerListaCompleta();
  const usados = new Set();
  const elegidos = [];

  while (elegidos.length < cantidad) {
    const idx = Math.floor(Math.random() * lista.length);
    if (usados.has(idx)) continue;
    usados.add(idx);
    elegidos.push(lista[idx]);
  }

  return obtenerCartasPorId(elegidos.map((p) => p.id));
}
