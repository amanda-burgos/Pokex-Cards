import { z } from "zod";
import {
  obtenerUsuarioPorId,
  crearSobre,
  asociarSessionStripe,
  obtenerSobre,
  ajustarSaldo,
  listarPokedex,
  listarInventario,
  obtenerInventarioItem,
  eliminarDeInventario,
  agregarAPokedex,
} from "../src/db.js";
import { buscarCatalogo, RAREZAS, obtenerCartasPorId } from "../src/pokeapi.js";
import { confirmarPago } from "../src/pagos.js";
import stripe from "../src/stripeClient.js";
import { TAMANO_SOBRE } from "../src/routes/sobres.js";
import {
  PRECIO_SOBRE_ALEATORIO_CENTAVOS,
  MAX_SOBRES_POR_COMPRA,
} from "../src/routes/sobreAleatorio.js";
import {
  CANTIDAD_A_RECLAMAR,
  PORCENTAJE_VENTA,
} from "../src/routes/inventario.js";

function texto(datos) {
  return { content: [{ type: "text", text: JSON.stringify(datos) }] };
}

function error(mensaje) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: mensaje }) }],
    isError: true,
  };
}

async function construirLineItems(sobre) {
  if (sobre.tipo === "aleatorio") {
    return [
      {
        quantity: sobre.cantidad,
        price_data: {
          currency: "usd",
          unit_amount: PRECIO_SOBRE_ALEATORIO_CENTAVOS,
          product_data: { name: "Sobre Sorpresa (3 cartas al azar)" },
        },
      },
    ];
  }

  const ids = JSON.parse(sobre.pokemon_ids);
  const cartas = await obtenerCartasPorId(ids);
  return cartas.map((carta) => ({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: carta.precioCentavos,
      product_data: {
        name: `${carta.nombre} (${carta.rareza})`,
        images: carta.imagen ? [carta.imagen] : undefined,
      },
    },
  }));
}

// Cada tool que toca datos de un usuario recibe `usuarioId` en su schema, pero
// ese campo nunca se expone al modelo: src/mcpClient.js lo retira de lo que ve
// el LLM y lo inyecta del lado del servidor con el usuario de la sesion.
export const tools = [
  {
    name: "buscar_catalogo",
    description:
      "Busca cartas Pokemon en el catalogo por nombre, numero o rareza (paginado, 24 por pagina).",
    schema: {
      search: z.string().optional().describe("Nombre o numero de pokemon a buscar"),
      rareza: z.enum(RAREZAS).optional().describe("Filtra por rareza exacta"),
      page: z.number().int().min(1).optional().describe("Numero de pagina, default 1"),
    },
    handler: async ({ search = "", rareza = "", page = 1 }) => {
      const resultado = await buscarCatalogo({ search, rareza, page, pageSize: 24 });
      return texto(resultado);
    },
  },

  {
    name: "listar_rarezas",
    description: "Lista las rarezas de cartas disponibles para filtrar el catalogo.",
    schema: {},
    handler: async () => texto({ rarezas: RAREZAS }),
  },

  {
    name: "cotizar_cartas",
    description:
      "Calcula el precio total de una lista de cartas por su ID de pokemon, sin comprar nada todavia. Usala para mostrarle el total al usuario y que confirme antes de comprar_sobre_directo.",
    schema: {
      pokemonIds: z.array(z.number().int()).min(1).describe("IDs de pokemon a cotizar"),
    },
    handler: async ({ pokemonIds }) => {
      const cartas = await obtenerCartasPorId(pokemonIds);
      const totalCentavos = cartas.reduce((sum, c) => sum + c.precioCentavos, 0);
      return texto({ cartas, totalCentavos });
    },
  },

  {
    name: "consultar_perfil",
    description: "Devuelve el usuario autenticado: su username y su saldo disponible en centavos.",
    schema: { usuarioId: z.number().int() },
    handler: async ({ usuarioId }) => {
      const usuario = obtenerUsuarioPorId(usuarioId);
      if (!usuario) return error("Usuario no encontrado");
      return texto({
        id: usuario.id,
        username: usuario.username,
        saldoCentavos: usuario.saldo_centavos,
      });
    },
  },

  {
    name: "comprar_sobre_directo",
    description: `Compra un sobre eligiendo exactamente ${TAMANO_SOBRE} cartas por su ID de pokemon. Si el saldo alcanza se paga al instante (pagadoConSaldo:true); si no, devuelve requierePago:true y hay que usar abrir_link_de_pago con el sobreId.`,
    schema: {
      usuarioId: z.number().int(),
      pokemonIds: z
        .array(z.number().int())
        .length(TAMANO_SOBRE)
        .describe(`Exactamente ${TAMANO_SOBRE} IDs de pokemon, uno por carta elegida`),
    },
    handler: async ({ usuarioId, pokemonIds }) => {
      const usuario = obtenerUsuarioPorId(usuarioId);
      if (!usuario) return error("Usuario no encontrado");

      const cartas = await obtenerCartasPorId(pokemonIds);
      const totalCentavos = cartas.reduce((sum, c) => sum + c.precioCentavos, 0);
      const sobreId = crearSobre({ usuarioId, tipo: "directo", pokemonIds, totalCentavos });

      if (usuario.saldo_centavos >= totalCentavos) {
        ajustarSaldo(usuario.id, -totalCentavos);
        await confirmarPago(obtenerSobre(sobreId));
        return texto({ pagadoConSaldo: true, sobreId, totalCentavos, cartas });
      }

      return texto({ pagadoConSaldo: false, sobreId, totalCentavos, requierePago: true, cartas });
    },
  },

  {
    name: "consultar_precio_sobre_aleatorio",
    description: "Devuelve el precio por sobre sorpresa y la cantidad maxima permitida por compra.",
    schema: {},
    handler: async () =>
      texto({
        precioCentavos: PRECIO_SOBRE_ALEATORIO_CENTAVOS,
        maxCantidad: MAX_SOBRES_POR_COMPRA,
      }),
  },

  {
    name: "comprar_sobre_aleatorio",
    description: `Compra entre 1 y ${MAX_SOBRES_POR_COMPRA} sobres sorpresa (3 cartas al azar cada uno). Si el saldo alcanza se paga al instante (pagadoConSaldo:true); si no, devuelve requierePago:true y hay que usar abrir_link_de_pago con el sobreId.`,
    schema: {
      usuarioId: z.number().int(),
      cantidad: z
        .number()
        .int()
        .min(1)
        .max(MAX_SOBRES_POR_COMPRA)
        .describe("Cantidad de sobres sorpresa a comprar"),
    },
    handler: async ({ usuarioId, cantidad }) => {
      const usuario = obtenerUsuarioPorId(usuarioId);
      if (!usuario) return error("Usuario no encontrado");

      const totalCentavos = cantidad * PRECIO_SOBRE_ALEATORIO_CENTAVOS;
      const sobreId = crearSobre({ usuarioId, tipo: "aleatorio", cantidad, pokemonIds: [], totalCentavos });

      if (usuario.saldo_centavos >= totalCentavos) {
        ajustarSaldo(usuario.id, -totalCentavos);
        await confirmarPago(obtenerSobre(sobreId));
        return texto({ pagadoConSaldo: true, sobreId, totalCentavos });
      }

      return texto({ pagadoConSaldo: false, sobreId, totalCentavos, requierePago: true });
    },
  },

  {
    name: "consultar_sobre",
    description:
      "Consulta el estado y contenido de un sobre por su sobreId. Si el pago ya se completo en Stripe, actualiza el estado a pagado automaticamente.",
    schema: { usuarioId: z.number().int(), sobreId: z.number().int() },
    handler: async ({ usuarioId, sobreId }) => {
      let sobre = obtenerSobre(sobreId);
      if (!sobre || sobre.usuario_id !== usuarioId) return error("Sobre no encontrado");

      // El estado normalmente se actualiza por el webhook de Stripe. En
      // desarrollo local ese webhook no llega si no corre `stripe listen`,
      // asi que aca se verifica directo con Stripe como respaldo.
      if (sobre.estado !== "pagado" && sobre.stripe_session_id) {
        const session = await stripe.checkout.sessions.retrieve(sobre.stripe_session_id);
        if (session.payment_status === "paid") {
          await confirmarPago(sobre);
          sobre = obtenerSobre(sobreId);
        }
      }

      const ids = JSON.parse(sobre.pokemon_ids);
      const cartas = ids.length ? await obtenerCartasPorId(ids) : [];
      return texto({
        id: sobre.id,
        tipo: sobre.tipo,
        estado: sobre.estado,
        totalCentavos: sobre.total_centavos,
        cartas,
      });
    },
  },

  {
    name: "abrir_link_de_pago",
    description:
      "Genera (o reutiliza si sigue abierto) el link de pago de Stripe para completar la compra de un sobre pendiente. Toda compra que no se cubra con saldo requiere pasar por aqui.",
    schema: { usuarioId: z.number().int(), sobreId: z.number().int() },
    handler: async ({ usuarioId, sobreId }) => {
      const sobre = obtenerSobre(sobreId);
      if (!sobre || sobre.usuario_id !== usuarioId) return error("Sobre no encontrado");
      if (sobre.estado === "pagado") return texto({ yaPagado: true, sobreId });

      if (sobre.stripe_session_id) {
        const sessionExistente = await stripe.checkout.sessions.retrieve(sobre.stripe_session_id);
        if (sessionExistente.status === "open") {
          return texto({ sobreId, url: sessionExistente.url });
        }
      }

      const line_items = await construirLineItems(sobre);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items,
        metadata: { sobreId: String(sobreId) },
        success_url: `${process.env.DOMAIN}/success.html?sobre=${sobreId}`,
        cancel_url: `${process.env.DOMAIN}/index.html?cancelado=1`,
      });
      asociarSessionStripe(sobreId, session.id);
      return texto({ sobreId, url: session.url });
    },
  },

  {
    name: "listar_pokedex",
    description: "Lista las cartas que ya son del usuario (compradas o reclamadas) en su Pokedex.",
    schema: { usuarioId: z.number().int() },
    handler: async ({ usuarioId }) => {
      const items = listarPokedex(usuarioId);
      if (items.length === 0) return texto([]);

      const detalles = await obtenerCartasPorId(items.map((i) => i.pokemon_id));
      const detallePorId = new Map(detalles.map((d) => [d.id, d]));

      return texto(
        items.map((i) => ({
          pokedexId: i.id,
          origen: i.origen,
          obtenidoEn: i.obtenido_en,
          ...detallePorId.get(i.pokemon_id),
        }))
      );
    },
  },

  {
    name: "listar_inventario",
    description:
      "Lista las cartas del inventario del usuario: cartas de sobres sorpresa pendientes de reclamar o vender.",
    schema: { usuarioId: z.number().int() },
    handler: async ({ usuarioId }) => {
      const items = listarInventario(usuarioId);
      if (items.length === 0) return texto([]);

      const detalles = await obtenerCartasPorId(items.map((i) => i.pokemon_id));
      const detallePorId = new Map(detalles.map((d) => [d.id, d]));

      return texto(
        items.map((i) => ({
          inventarioId: i.id,
          obtenidoEn: i.obtenido_en,
          ...detallePorId.get(i.pokemon_id),
        }))
      );
    },
  },

  {
    name: "reclamar_cartas",
    description: `Mueve exactamente ${CANTIDAD_A_RECLAMAR} cartas del inventario a la Pokedex definitiva del usuario.`,
    schema: {
      usuarioId: z.number().int(),
      inventarioIds: z
        .array(z.number().int())
        .length(CANTIDAD_A_RECLAMAR)
        .describe(`Exactamente ${CANTIDAD_A_RECLAMAR} inventarioId a reclamar`),
    },
    handler: async ({ usuarioId, inventarioIds }) => {
      const items = inventarioIds.map((id) => obtenerInventarioItem(id, usuarioId));
      if (items.some((i) => !i)) {
        return error("Alguna carta seleccionada no esta en el inventario del usuario");
      }

      for (const item of items) {
        agregarAPokedex(usuarioId, item.pokemon_id, "aleatorio");
        eliminarDeInventario(item.id, usuarioId);
      }

      return texto({ ok: true });
    },
  },

  {
    name: "vender_carta",
    description: `Vende una carta del inventario del usuario a cambio de saldo (${PORCENTAJE_VENTA * 100}% de su precio).`,
    schema: { usuarioId: z.number().int(), inventarioId: z.number().int() },
    handler: async ({ usuarioId, inventarioId }) => {
      const item = obtenerInventarioItem(inventarioId, usuarioId);
      if (!item) return error("Esa carta no esta en el inventario del usuario");

      const [carta] = await obtenerCartasPorId([item.pokemon_id]);
      const saldoSumado = Math.round(carta.precioCentavos * PORCENTAJE_VENTA);
      eliminarDeInventario(item.id, usuarioId);
      ajustarSaldo(usuarioId, saldoSumado);

      return texto({ ok: true, saldoSumado });
    },
  },
];
