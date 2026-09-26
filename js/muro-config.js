// Conexión del muro público de resultados (Supabase).
// La clave es la «anon» o «publishable» del proyecto: es pública por diseño, porque la base
// de datos solo deja leer el muro y añadir resultados (ver data/muro.sql).
// Mientras estén vacías, el muro no aparece en el juego.
window.MURO_CONFIG = {
  url: "",
  clave: "",
};
