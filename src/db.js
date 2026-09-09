import Database from "better-sqlite3";

const db = new Database("entrenador.db");
// WAL evita bloqueos si el MCP standalone (mcp-server/stdio.js) corre al
// mismo tiempo que el servidor Express contra el mismo archivo de sqlite.
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    saldo_centavos INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sobres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    tipo TEXT NOT NULL DEFAULT 'directo',
    cantidad INTEGER NOT NULL DEFAULT 1,
    pokemon_ids TEXT NOT NULL,
    total_centavos INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    stripe_session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pokedex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    pokemon_id INTEGER NOT NULL,
    origen TEXT NOT NULL,
    obtenido_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    pokemon_id INTEGER NOT NULL,
    obtenido_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS catalogo_detalle (
    pokemon_id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    imagen TEXT,
    rareza TEXT NOT NULL,
    precio_centavos INTEGER NOT NULL
  );
`);

// Migracion: la tabla usuarios se creo originalmente sin email.
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN email TEXT");
} catch (err) {
  if (!/duplicate column/i.test(err.message)) throw err;
}

// --- Usuarios ---

export function crearUsuario(username, passwordHash, email) {
  const info = db
    .prepare(
      "INSERT INTO usuarios (username, password_hash, email) VALUES (?, ?, ?)"
    )
    .run(username, passwordHash, email);
  return info.lastInsertRowid;
}

export function obtenerUsuarioPorUsername(username) {
  return db.prepare("SELECT * FROM usuarios WHERE username = ?").get(username);
}

export function obtenerUsuarioPorId(id) {
  return db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
}

export function ajustarSaldo(usuarioId, deltaCentavos) {
  db.prepare(
    "UPDATE usuarios SET saldo_centavos = saldo_centavos + ? WHERE id = ?"
  ).run(deltaCentavos, usuarioId);
}

// --- Sobres ---

export function crearSobre({ usuarioId, tipo, cantidad = 1, pokemonIds, totalCentavos }) {
  const info = db
    .prepare(
      "INSERT INTO sobres (usuario_id, tipo, cantidad, pokemon_ids, total_centavos) VALUES (?, ?, ?, ?, ?)"
    )
    .run(usuarioId, tipo, cantidad, JSON.stringify(pokemonIds), totalCentavos);
  return info.lastInsertRowid;
}

export function asociarSessionStripe(sobreId, sessionId) {
  db.prepare("UPDATE sobres SET stripe_session_id = ? WHERE id = ?").run(
    sessionId,
    sobreId
  );
}

export function actualizarPokemonIds(sobreId, pokemonIds) {
  db.prepare("UPDATE sobres SET pokemon_ids = ? WHERE id = ?").run(
    JSON.stringify(pokemonIds),
    sobreId
  );
}

export function marcarComoPagado(sobreId) {
  db.prepare("UPDATE sobres SET estado = 'pagado' WHERE id = ?").run(sobreId);
}

export function obtenerSobre(id) {
  return db.prepare("SELECT * FROM sobres WHERE id = ?").get(id);
}

export function obtenerSobrePorSessionId(sessionId) {
  return db
    .prepare("SELECT * FROM sobres WHERE stripe_session_id = ?")
    .get(sessionId);
}

// --- Pokedex (cartas reclamadas / propias) ---

export function agregarAPokedex(usuarioId, pokemonId, origen) {
  db.prepare(
    "INSERT INTO pokedex (usuario_id, pokemon_id, origen) VALUES (?, ?, ?)"
  ).run(usuarioId, pokemonId, origen);
}

export function listarPokedex(usuarioId) {
  return db
    .prepare(
      "SELECT * FROM pokedex WHERE usuario_id = ? ORDER BY obtenido_en DESC"
    )
    .all(usuarioId);
}

// --- Inventario (cartas de sobres aleatorios sin reclamar/vender) ---

export function agregarAInventario(usuarioId, pokemonId) {
  db.prepare(
    "INSERT INTO inventario (usuario_id, pokemon_id) VALUES (?, ?)"
  ).run(usuarioId, pokemonId);
}

export function listarInventario(usuarioId) {
  return db
    .prepare(
      "SELECT * FROM inventario WHERE usuario_id = ? ORDER BY obtenido_en DESC"
    )
    .all(usuarioId);
}

export function obtenerInventarioItem(id, usuarioId) {
  return db
    .prepare("SELECT * FROM inventario WHERE id = ? AND usuario_id = ?")
    .get(id, usuarioId);
}

export function eliminarDeInventario(id, usuarioId) {
  db.prepare("DELETE FROM inventario WHERE id = ? AND usuario_id = ?").run(
    id,
    usuarioId
  );
}

// --- Cache de detalles de PokeAPI ---

export function obtenerDetalleCacheado(pokemonId) {
  const fila = db
    .prepare("SELECT * FROM catalogo_detalle WHERE pokemon_id = ?")
    .get(pokemonId);
  if (!fila) return null;
  return {
    id: fila.pokemon_id,
    nombre: fila.nombre,
    imagen: fila.imagen,
    rareza: fila.rareza,
    precioCentavos: fila.precio_centavos,
  };
}

export function guardarDetalleCache(detalle) {
  db.prepare(
    `INSERT INTO catalogo_detalle (pokemon_id, nombre, imagen, rareza, precio_centavos)
     VALUES (@id, @nombre, @imagen, @rareza, @precioCentavos)
     ON CONFLICT(pokemon_id) DO UPDATE SET
       nombre = excluded.nombre,
       imagen = excluded.imagen,
       rareza = excluded.rareza,
       precio_centavos = excluded.precio_centavos`
  ).run(detalle);
}

export default db;
