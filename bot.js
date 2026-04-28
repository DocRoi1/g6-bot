// ============================================================
// BOT DISCORD — Gruppe 6 Modération
// ============================================================
 
process.on('uncaughtException', (err) => {
  console.error('ERREUR FATALE:', err.message);
  console.error(err.stack);
  process.exit(1);
});
 
process.on('unhandledRejection', (reason) => {
  console.error('PROMESSE REJETÉE:', reason);
  process.exit(1);
});
 
console.log("=== DÉMARRAGE BOT GRUPPE 6 ===");
console.log("Node version:", process.version);
console.log("BOT_TOKEN  :", process.env.BOT_TOKEN  ? "✅ présent (" + process.env.BOT_TOKEN.length + " chars)" : "❌ MANQUANT");
console.log("WEBAPP_URL :", process.env.WEBAPP_URL ? "✅ " + process.env.WEBAPP_URL.substring(0,50) + "..." : "❌ MANQUANT");
console.log("CHANNEL_ID :", process.env.CHANNEL_ID || "❌ MANQUANT");
 
const TOKEN      = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const CHANNEL_ID = process.env.CHANNEL_ID || "1498184266045984881";
 
if (!TOKEN)      { console.error("❌ BOT_TOKEN manquant"); process.exit(1); }
if (!WEBAPP_URL) { console.error("❌ WEBAPP_URL manquant"); process.exit(1); }
 
console.log("✅ Variables OK, chargement discord.js...");
 
const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder,
        ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
        TextInputStyle, EmbedBuilder, Events } = require('discord.js');
 
console.log("✅ discord.js chargé");
 
const fs = require('fs');
const MESSAGE_ID_FILE = "./message_id.txt";
 
const ROLES_CONFIG = {
  "Administrateur": { emoji: "⚡", color: 0xFF3B5C, desc: "Accès total — Gère tout" },
  "Gestionnaire":   { emoji: "🧑‍💼", color: 0x00E5FF, desc: "Documents + Planning — Peut modifier" },
  "Lecteur":        { emoji: "👁",  color: 0x00FF88, desc: "Lecture seule — Aucune modification" },
  "Auditeur":       { emoji: "🔍", color: 0xFFB300, desc: "Lecture + Logs — Ne modifie rien" },
  "Visiteur":       { emoji: "🔒", color: 0x556677, desc: "Page d'accueil uniquement" },
  "Refuser":        { emoji: "🚫", color: 0xFF3B5C, desc: "Supprimer l'accès" }
};
 
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});
 
async function callAppsScript(action, params) {
  try {
    const queryParams = new URLSearchParams({ action });
    if (params) Object.entries(params).forEach(([k, v]) => queryParams.append(k, v));
    const url = WEBAPP_URL + "?" + queryParams.toString();
    console.log("→ Appel Apps Script:", action);
    const resp = await fetch(url, { method: "GET", redirect: "follow" });
    const text = await resp.text();
    console.log("← Réponse:", text.substring(0, 150));
    if (text.trim().startsWith("<")) return { error: "HTML reçu — vérifiez le déploiement Apps Script (accès: Tout le monde)" };
    return JSON.parse(text);
  } catch(e) {
    console.error("❌ Erreur Apps Script:", e.message);
    return { error: e.message };
  }
}
 
function buildPanelMessage() {
  const embed = new EmbedBuilder()
    .setTitle("🛡️ Centre de Modération — Gruppe 6")
    .setDescription("Gérez les accès à la plateforme de gestion.\nSélectionnez une action dans le menu ci-dessous.")
    .setColor(0xFF3B5C)
    .addFields(
      { name: "⚡ Administrateur", value: "Accès total", inline: true },
      { name: "🧑‍💼 Gestionnaire",  value: "Documents + Planning", inline: true },
      { name: "👁 Lecteur",        value: "Lecture seule", inline: true },
      { name: "🔍 Auditeur",       value: "Lecture + Logs", inline: true },
      { name: "🔒 Visiteur",       value: "Aucun accès", inline: true },
      { name: "🚫 Refuser",        value: "Supprimer l'accès", inline: true }
    )
    .setFooter({ text: "Gruppe 6 — Modération • Actions loggées sur Discord" })
    .setTimestamp();
 
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("mod_ajouter").setLabel("Gérer un utilisateur").setEmoji("⚙️").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("mod_liste").setLabel("Voir les utilisateurs").setEmoji("📋").setStyle(ButtonStyle.Secondary)
  );
 
  return { embeds: [embed], components: [row] };
}
 
async function postOrUpdatePanel(channel) {
  const msg = buildPanelMessage();
  let savedId = null;
  try {
    if (fs.existsSync(MESSAGE_ID_FILE)) savedId = fs.readFileSync(MESSAGE_ID_FILE, 'utf8').trim();
  } catch(e) {}
 
  if (savedId) {
    try {
      const existing = await channel.messages.fetch(savedId);
      await existing.edit(msg);
      console.log("✅ Panel mis à jour, ID:", savedId);
      return;
    } catch(e) { console.log("⚠️ Ancien message introuvable, création d'un nouveau..."); }
  }
 
  const sent = await channel.send(msg);
  fs.writeFileSync(MESSAGE_ID_FILE, sent.id);
  console.log("✅ Panel créé, ID:", sent.id);
}
 
function buildEmailModal() {
  return new ModalBuilder()
    .setCustomId("modal_email")
    .setTitle("Gérer un utilisateur")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("email_input").setLabel("Adresse email").setStyle(TextInputStyle.Short).setPlaceholder("exemple@gmail.com").setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("nom_input").setLabel("Nom (optionnel)").setStyle(TextInputStyle.Short).setPlaceholder("Prénom Nom").setRequired(false)
      )
    );
}
 
function buildRoleMenu(email, nom) {
  const options = Object.entries(ROLES_CONFIG).map(([role, cfg]) => ({
    label: cfg.emoji + " " + role,
    description: cfg.desc,
    value: role + "|" + email + "|" + (nom || "")
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId("select_role").setPlaceholder("Choisir le rôle…").addOptions(options)
  );
}
 
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.channelId !== CHANNEL_ID) return;
 
  if (interaction.isButton() && interaction.customId === "mod_ajouter") {
    await interaction.showModal(buildEmailModal());
    return;
  }
 
  if (interaction.isButton() && interaction.customId === "mod_liste") {
    await interaction.deferReply({ ephemeral: true });
    const result = await callAppsScript("liste", {});
    if (result.error) { await interaction.editReply({ content: "❌ " + result.error }); return; }
    const users = result.utilisateurs || [];
    if (!users.length) { await interaction.editReply({ content: "Aucun utilisateur enregistré." }); return; }
    const roleEmojis = { Administrateur:"🔴", Gestionnaire:"🔵", Lecteur:"🟢", Auditeur:"🟡", Visiteur:"⚫" };
    const embed = new EmbedBuilder()
      .setTitle("📋 Utilisateurs (" + users.length + ")")
      .setColor(0x00E5FF)
      .setDescription(users.map(u => (roleEmojis[u.role]||"⚪") + " **" + (u.nom||u.email) + "**\n└ " + u.email + " — " + u.role).join("\n\n"))
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }
 
  if (interaction.isModalSubmit() && interaction.customId === "modal_email") {
    const email = interaction.fields.getTextInputValue("email_input").trim();
    const nom   = interaction.fields.getTextInputValue("nom_input").trim();
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      await interaction.reply({ content: "❌ Email invalide : " + email, ephemeral: true });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle("👤 Gestion d'accès")
      .setColor(0xFF3B5C)
      .setDescription("Choisissez le rôle pour **" + email + "**\nou **Refuser** pour supprimer l'accès.")
      .addFields({ name: "📧 Email", value: email, inline: true }, { name: "👤 Nom", value: nom || "—", inline: true });
    await interaction.reply({ embeds: [embed], components: [buildRoleMenu(email, nom)], ephemeral: true });
    return;
  }
 
  if (interaction.isStringSelectMenu() && interaction.customId === "select_role") {
    const [role, email, nom] = interaction.values[0].split("|");
    await interaction.deferUpdate();
    let result;
    if (role === "Refuser") {
      result = await callAppsScript("refuser", { email });
    } else {
      result = await callAppsScript("accepter", { email, role, nom });
    }
    if (result.error) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFF3B5C).setDescription("❌ " + result.error)], components: [] });
      return;
    }
    const cfg = ROLES_CONFIG[role] || {};
    const embed = new EmbedBuilder()
      .setTitle(role === "Refuser" ? "🚫 Accès supprimé" : "✅ Accès accordé")
      .setColor(role === "Refuser" ? 0xFF3B5C : (cfg.color || 0x00FF88))
      .setDescription("**" + email + "** → " + (role === "Refuser" ? "Accès révoqué" : (cfg.emoji||"") + " " + role))
      .addFields({ name: "Par", value: interaction.user.tag, inline: true })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }
});
 
client.on(Events.ClientReady, async () => {
  console.log("✅ Bot connecté :", client.user.tag);
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) { console.error("❌ Salon introuvable, CHANNEL_ID:", CHANNEL_ID); return; }
    console.log("✅ Salon trouvé :", channel.name);
    await postOrUpdatePanel(channel);
  } catch(e) {
    console.error("❌ Erreur:", e.message);
  }
});
 
console.log("Connexion à Discord...");
client.login(TOKEN).catch(err => {
  console.error("❌ Échec connexion Discord:", err.message);
  if (err.message.includes("TOKEN_INVALID")) {
    console.error("→ Le token est invalide. Régénérez-le sur discord.com/developers");
  }
  process.exit(1);
});
