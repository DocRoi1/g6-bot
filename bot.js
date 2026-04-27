// ============================================================
// BOT DISCORD — Gruppe 6 Modération
// ============================================================
// Installation : npm install discord.js node-fetch
// Démarrage   : node bot.js
// Hébergement : Railway.app (gratuit) ou Render.com
// ============================================================

const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder,
        ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
        TextInputStyle, EmbedBuilder, Events } = require('discord.js');

// ══════════════════════════════════════════════════════════
// ⚠️  CONFIGUREZ CES 2 VALEURS AVANT DE DÉMARRER ⚠️
// ══════════════════════════════════════════════════════════
const CONFIG = {
  TOKEN:           process.env.BOT_TOKEN     || ${{ secrets.MTIyNTEyOTcxOTc0NjUyNzIzMg.G8nq-Q.q_UPPJlsV8oENubVvYhBGXBX23aBeyeSj4r4z8 }},
  CHANNEL_ID:      process.env.CHANNEL_ID    || ${{ secrets.1498184266045984881 }},
  WEBAPP_URL:      process.env.WEBAPP_URL    || "https://script.google.com/macros/s/AKfycbwtA_t9Z4BEjr7oN_SegKBtwMuMQ4dGFa4jvz-UABjpkzWGLZ524GM9wWeDMHBFXakR/exec",
  MESSAGE_ID_FILE: "./message_id.txt"
};

// Validation au démarrage
function validateConfig() {
  const errors = [];
  if (CONFIG.TOKEN === ${{ secrets.MTIyNTEyOTcxOTc0NjUyNzIzMg.G8nq-Q.q_UPPJlsV8oENubVvYhBGXBX23aBeyeSj4r4z8 }}, || !CONFIG.TOKEN)
    errors.push("❌ BOT_TOKEN manquant dans CONFIG.TOKEN");
  if (CONFIG.WEBAPP_URL === "https://script.google.com/macros/s/AKfycbwtA_t9Z4BEjr7oN_SegKBtwMuMQ4dGFa4jvz-UABjpkzWGLZ524GM9wWeDMHBFXakR/exec" || !CONFIG.WEBAPP_URL)
    errors.push("❌ WEBAPP_URL manquant dans CONFIG.WEBAPP_URL");
  if (errors.length) {
    console.error("\n╔══════════════════════════════════════╗");
    console.error("║  CONFIGURATION INCOMPLÈTE             ║");
    console.error("╚══════════════════════════════════════╝");
    errors.forEach(e => console.error(e));
    console.error("\n→ Modifiez bot.js et remplacez les valeurs marquées COLLEZ_...");
    process.exit(1);
  }
  console.log("✅ Config OK | Channel:", CONFIG.CHANNEL_ID);
}

const fs   = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// ── COULEURS & EMOJIS PAR RÔLE ─────────────────────────────
const ROLES_CONFIG = {
  "Administrateur": { emoji: "⚡", color: 0xFF3B5C, desc: "Accès total — Gère tout" },
  "Gestionnaire":   { emoji: "🧑‍💼", color: 0x00E5FF, desc: "Documents + Planning — Peut modifier" },
  "Lecteur":        { emoji: "👁",  color: 0x00FF88, desc: "Lecture seule — Aucune modification" },
  "Auditeur":       { emoji: "🔍", color: 0xFFB300, desc: "Lecture + Logs — Ne modifie rien" },
  "Visiteur":       { emoji: "🔒", color: 0x556677, desc: "Page d'accueil uniquement" },
  "Refuser":        { emoji: "🚫", color: 0xFF3B5C, desc: "Supprimer l'accès" }
};

// ── MESSAGE PERSISTANT ─────────────────────────────────────
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
    .setFooter({ text: "Gruppe 6 — Système de modération • Actions loggées sur Discord" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mod_ajouter")
      .setLabel("Gérer un utilisateur")
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("mod_liste")
      .setLabel("Voir les utilisateurs")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

async function postOrUpdatePanel(channel) {
  const msg = buildPanelMessage();

  // Chercher si un message précédent existe
  let savedId = null;
  try {
    if (fs.existsSync(CONFIG.MESSAGE_ID_FILE)) {
      savedId = fs.readFileSync(CONFIG.MESSAGE_ID_FILE, 'utf8').trim();
    }
  } catch(e) {}

  if (savedId) {
    try {
      const existing = await channel.messages.fetch(savedId);
      await existing.edit(msg);
      console.log("✅ Message panel mis à jour :", savedId);
      return existing;
    } catch(e) {
      console.log("⚠️ Ancien message introuvable, nouveau message créé.");
    }
  }

  const sent = await channel.send(msg);
  fs.writeFileSync(CONFIG.MESSAGE_ID_FILE, sent.id);
  console.log("✅ Panel créé, ID :", sent.id);
  return sent;
}

// ── MODAL SAISIE EMAIL ─────────────────────────────────────
function buildEmailModal() {
  return new ModalBuilder()
    .setCustomId("modal_email")
    .setTitle("Gérer un utilisateur")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("email_input")
          .setLabel("Adresse email de l'utilisateur")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("exemple@gmail.com")
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("nom_input")
          .setLabel("Nom (optionnel)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Prénom Nom")
          .setRequired(false)
      )
    );
}

// ── MENU SÉLECTION RÔLE ────────────────────────────────────
function buildRoleMenu(email, nom) {
  const options = Object.entries(ROLES_CONFIG).map(([role, cfg]) => ({
    label: cfg.emoji + " " + role,
    description: cfg.desc,
    value: role + "|" + email + "|" + (nom || ""),
    emoji: { name: "🔘" }
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId("select_role")
    .setPlaceholder("Choisir le rôle à attribuer…")
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

// ── APPEL APPS SCRIPT ──────────────────────────────────────
async function callAppsScript(action, params) {
  try {
    // Apps Script accepte les GET — on encode les params dans l'URL
    const queryParams = new URLSearchParams({ action });
    if (params) {
      Object.entries(params).forEach(([k, v]) => queryParams.append(k, v));
    }
    const url = CONFIG.WEBAPP_URL + "?" + queryParams.toString();
    console.log("→ Apps Script GET:", action, JSON.stringify(params));

    const resp = await fetch(url, {
      method:  "GET",
      headers: { "Accept": "application/json" },
      redirect: "follow"  // Apps Script redirige vers l'URL finale
    });

    const text = await resp.text();
    console.log("← Réponse brute:", text.substring(0, 300));

    // Apps Script peut renvoyer du HTML si mal configuré
    if (text.trim().startsWith("<")) {
      return { error: "Apps Script a renvoyé du HTML — vérifiez le déploiement (accès: Tout le monde)" };
    }

    try {
      return JSON.parse(text);
    } catch(e) {
      return { error: "JSON invalide: " + text.substring(0, 100) };
    }
  } catch(e) {
    console.error("❌ Fetch err:", e.message);
    return { error: e.message };
  }
}

// ── INTERACTIONS ───────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {

  // Vérifier que l'interaction vient du bon salon
  if (interaction.channelId !== CONFIG.CHANNEL_ID) return;

  // ── Bouton : Gérer un utilisateur ──
  if (interaction.isButton() && interaction.customId === "mod_ajouter") {
    await interaction.showModal(buildEmailModal());
    return;
  }

  // ── Bouton : Voir les utilisateurs ──
  if (interaction.isButton() && interaction.customId === "mod_liste") {
    await interaction.deferReply({ ephemeral: true });
    const result = await callAppsScript("liste", {});
    if (result.error || !result.utilisateurs) {
      await interaction.editReply({ content: "❌ Erreur : " + (result.error || "Impossible de charger la liste.") });
      return;
    }
    const users = result.utilisateurs;
    if (!users.length) {
      await interaction.editReply({ content: "Aucun utilisateur enregistré." });
      return;
    }
    const roleColors = { Administrateur:"🔴", Gestionnaire:"🔵", Lecteur:"🟢", Auditeur:"🟡", Visiteur:"⚫" };
    const embed = new EmbedBuilder()
      .setTitle("📋 Utilisateurs enregistrés (" + users.length + ")")
      .setColor(0x00E5FF)
      .setDescription(
        users.map(u =>
          (roleColors[u.role]||"⚪") + " **" + (u.nom||u.email) + "**\n" +
          "└ `" + u.email + "` — " + (ROLES_CONFIG[u.role]?.emoji||"") + " " + u.role
        ).join("\n\n")
      )
      .setFooter({ text: "Gruppe 6 — " + users.length + " utilisateur(s)" })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── Modal : Saisie email ──
  if (interaction.isModalSubmit() && interaction.customId === "modal_email") {
    const email = interaction.fields.getTextInputValue("email_input").trim();
    const nom   = interaction.fields.getTextInputValue("nom_input").trim();

    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      await interaction.reply({ content: "❌ Email invalide : `" + email + "`", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("👤 Gestion d'accès")
      .setColor(0xFF3B5C)
      .addFields(
        { name: "📧 Email",  value: "`" + email + "`", inline: true },
        { name: "👤 Nom",    value: nom || "_non renseigné_",    inline: true }
      )
      .setDescription("Choisissez le rôle à attribuer ou **Refuser** pour supprimer l'accès.")
      .setFooter({ text: "Groupe 6 — Modération" });

    await interaction.reply({
      embeds: [embed],
      components: [buildRoleMenu(email, nom)],
      ephemeral: true
    });
    return;
  }

  // ── Menu : Sélection rôle ──
  if (interaction.isStringSelectMenu() && interaction.customId === "select_role") {
    const [role, email, nom] = interaction.values[0].split("|");
    await interaction.deferUpdate();

    let result;
    let titre, couleur, description;

    if (role === "Refuser") {
      result = await callAppsScript("refuser", { email });
      titre   = "🚫 Accès supprimé";
      couleur = 0xFF3B5C;
      description = "L'accès de `" + email + "` a été **révoqué**.";
    } else {
      result = await callAppsScript("accepter", { email, role, nom });
      const cfg = ROLES_CONFIG[role] || {};
      titre   = "✅ Accès accordé";
      couleur = cfg.color || 0x00FF88;
      description = "L'accès de `" + email + "` a été défini sur **" + cfg.emoji + " " + role + "**.";
    }

    if (result.error) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF3B5C).setDescription("❌ Erreur : " + result.error)],
        components: []
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(titre)
      .setColor(couleur)
      .setDescription(description)
      .addFields(
        { name: "📧 Email",  value: "`" + email + "`",    inline: true },
        { name: "🎭 Rôle",   value: role,                  inline: true },
        { name: "👤 Par",    value: interaction.user.tag,  inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "Gruppe 6 — Modération" });

    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }
});

// ── PRÊT ───────────────────────────────────────────────────
client.on(Events.ClientReady, async () => {
  console.log("✅ Bot connecté en tant que " + client.user.tag);

  try {
    const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
    if (!channel) { console.error("❌ Salon introuvable."); return; }
    await postOrUpdatePanel(channel);
    console.log("✅ Panel de modération actif dans #" + channel.name);
  } catch(e) {
    console.error("❌ Erreur panel :", e.message);
  }
});

// ── CONNEXION ──────────────────────────────────────────────
validateConfig();
client.login(CONFIG.TOKEN);
