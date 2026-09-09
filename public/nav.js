async function initNav() {
  const res = await fetch("/api/auth/me");

  if (!res.ok) {
    window.location.href = "/login.html";
    return null;
  }

  const usuario = await res.json();
  const nav = document.getElementById("nav-usuario");

  if (nav) {
    nav.innerHTML = `
      <span>${usuario.username} — Saldo: $${(usuario.saldoCentavos / 100).toFixed(2)}</span>
      <button id="logout-btn">Salir</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login.html";
    });
  }

  return usuario;
}
