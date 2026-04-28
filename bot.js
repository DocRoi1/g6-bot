// ============================================================
// BOT DISCORD — Gruppe 6 Modération
// Version finale — Variables d'environnement uniquement
// ============================================================

const { Client, GatewayIntentBits, ActionRowBuilder,
        StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
        ModalBuilder, TextInputBuilder, TextInputStyle,
        EmbedBuilder, Events } = require('discord.js');

const fs = require('fs');

// ── Configuration ────────────────────────────────────────────
const TOKEN      = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const CHANNEL_ID = process.env.CHANNEL_ID || '1498184266045984881';
const ID_FILE    = './panel_id.txt';

// ── Vérification au démarrage ────────────────────────────────
console.log('[BOT] Démarrage...');
console.log('[BOT] BOT_TOKEN  :', TOKEN      ? '✅ (' + TOKEN.length + ' chars)' : '❌ MANQUANT');
console.log('[BOT] WEBAPP_URL :', WEBAPP_URL ? '✅ ' + WEBAPP_URL.slice(0, 60) + '...' : '❌ MANQUANT');
console.log('[BOT] CHANNEL_ID :', CHANNEL_ID);

if (!TOKEN)      { console.error('[ERREUR] BOT_TOKEN manquant'); process.exit(1); }
if (!WEBAPP_URL) { console.error('[ERREUR] WEBAPP_URL manquant'); process.exit(1); }

// ── Rôles ────────────────────────────────────────────────────
const ROLES = {
  Administrateur: { emoji: '⚡', color: 0xFF3B5C, desc: 'Accès total' },
  Gestionnaire:   { emoji: '🧑‍💼', color: 0x00E5FF, desc: 'Documents + Planning' },
  Lecteur:        { emoji: '👁',  color: 0x00FF88, desc: 'Lecture seule' },
  Auditeur:       { emoji: '🔍', color: 0xFFB300, desc: 'Lecture + Logs' },
  Visiteur:       { emoji: '🔒', color: 0x556677, desc: 'Accès limité' },
  Refuser:        { emoji: '🚫', color: 0xFF3B5C, desc: 'Supprimer l\'accès' }
};

// ── Client Discord ───────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// ── Appel Apps Script ────────────────────────────────────────
async function callAPI(action, params = {}) {
  try {
    const qs  = new URLSearchParams({ action, ...params });
    const url = WEBAPP_URL + '?' + qs.toString();
    console.log('[API] →', action, params);

    const res  = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    console.log('[API] ←', text.slice(0, 200));

    if (text.trim().startsWith('<')) {
      return { ok: false, error: 'HTML reçu — vérifiez le déploiement Apps Script' };
    }
    return JSON.parse(text);
  } catch (e) {
    console.error('[API] Erreur:', e.message);
    return { ok: false, error: e.message };
  }
}

// ── Message panel principal ──────────────────────────────────
function buildPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ Modération — Gruppe 6')
    .setDescription('Gérez les accès à la plateforme.\nCliquez sur un bouton ci-dessous.')
    .setColor(0xFF3B5C)
    .addFields(
      { name: '⚡ Administrateur', value: 'Accès total',          inline: true },
      { name: '🧑‍💼 Gestionnaire',   value: 'Documents + Planning', inline: true },
      { name: '👁 Lecteur',         value: 'Lecture seule',        inline: true },
      { name: '🔍 Auditeur',        value: 'Lecture + Logs',       inline: true },
      { name: '🔒 Visiteur',        value: 'Accès limité',         inline: true },
      { name: '🚫 Refuser',         value: 'Supprimer l\'accès',   inline: true }
    )
    .setFooter({ text: 'Gruppe 6 • Actions loggées' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_gerer')
      .setLabel('Gérer un utilisateur')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_liste')
      .setLabel('Voir les utilisateurs')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

async function envoyerPanel(channel) {
  const msg = buildPanel();
  let savedId = null;

  try {
    if (fs.existsSync(ID_FILE)) {
      savedId = fs.readFileSync(ID_FILE, 'utf8').trim();
    }
  } catch (e) {}

  if (savedId) {
    try {
      const existing = await channel.messages.fetch(savedId);
      await existing.edit(msg);
      console.log('[BOT] Panel mis à jour:', savedId);
      return;
    } catch (e) {
      console.log('[BOT] Ancien message introuvable, création...');
    }
  }

  const sent = await channel.send(msg);
  fs.writeFileSync(ID_FILE, sent.id);
  console.log('[BOT] Panel créé:', sent.id);
}

// ── Modal email ──────────────────────────────────────────────
function buildModal() {
  return new ModalBuilder()
    .setCustomId('modal_email')
    .setTitle('Gérer un utilisateur')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('inp_email')
          .setLabel('Adresse email')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('exemple@gmail.com')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('inp_nom')
          .setLabel('Nom (optionnel)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Prénom Nom')
          .setRequired(false)
      )
    );
}

// ── Menu rôles ───────────────────────────────────────────────
function buildRoleMenu(email, nom) {
  const options = Object.entries(ROLES).map(([role, cfg]) => ({
    label: cfg.emoji + ' ' + role,
    description: cfg.desc,
    value: [role, email, nom || ''].join('|')
  }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('menu_role')
      .setPlaceholder('Choisir un rôle…')
      .addOptions(options)
  );
}

// ── Interactions ─────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.channelId !== CHANNEL_ID) return;

  // Bouton : Gérer
  if (interaction.isButton() && interaction.customId === 'btn_gerer') {
    await interaction.showModal(buildModal());
    return;
  }

  // Bouton : Liste
  if (interaction.isButton() && interaction.customId === 'btn_liste') {
    await interaction.deferReply({ ephemeral: true });

    const result = await callAPI('liste');
    if (!result.ok || !result.utilisateurs) {
      await interaction.editReply('❌ Erreur : ' + (result.error || 'Impossible de charger'));
      return;
    }

    const users = result.utilisateurs;
    if (!users.length) {
      await interaction.editReply('Aucun utilisateur enregistré.');
      return;
    }

    const emojis = { Administrateur:'🔴', Gestionnaire:'🔵', Lecteur:'🟢', Auditeur:'🟡', Visiteur:'⚫' };
    const lines  = users.map(u =>
      (emojis[u.role] || '⚪') + ' **' + (u.nom || u.email) + '**\n└ `' + u.email + '` — ' + u.role
    ).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('📋 Utilisateurs (' + users.length + ')')
      .setColor(0x00E5FF)
      .setDescription(lines)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Modal : Email saisi
  if (interaction.isModalSubmit() && interaction.customId === 'modal_email') {
    const email = interaction.fields.getTextInputValue('inp_email').trim();
    const nom   = interaction.fields.getTextInputValue('inp_nom').trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      await interaction.reply({ content: '❌ Email invalide : `' + email + '`', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('👤 Attribution de rôle')
      .setColor(0xFF3B5C)
      .setDescription('Choisissez le rôle pour **' + email + '**\nou **Refuser** pour supprimer son accès.')
      .addFields(
        { name: '📧 Email', value: '`' + email + '`', inline: true },
        { name: '👤 Nom',   value: nom || '—',          inline: true }
      );

    await interaction.reply({
      embeds: [embed],
      components: [buildRoleMenu(email, nom)],
      ephemeral: true
    });
    return;
  }

  // Menu : Rôle sélectionné
  if (interaction.isStringSelectMenu() && interaction.customId === 'menu_role') {
    const [role, email, nom] = interaction.values[0].split('|');
    await interaction.deferUpdate();

    const action = role === 'Refuser' ? 'refuser' : 'accepter';
    const result = await callAPI(action, { email, role, nom });

    if (!result.ok) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF3B5C).setDescription('❌ ' + (result.error || 'Erreur'))],
        components: []
      });
      return;
    }

    const cfg  = ROLES[role] || {};
    const ok   = role !== 'Refuser';
    const embed = new EmbedBuilder()
      .setTitle(ok ? '✅ Accès accordé' : '🚫 Accès supprimé')
      .setColor(ok ? (cfg.color || 0x00FF88) : 0xFF3B5C)
      .setDescription('**' + email + '** → ' + (ok ? cfg.emoji + ' ' + role : 'Accès révoqué'))
      .addFields(
        { name: '📧 Email',    value: '`' + email + '`',        inline: true },
        { name: '🎭 Rôle',    value: role,                       inline: true },
        { name: '👤 Par',     value: '<@' + interaction.user.id + '>', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }
});

// ── Connexion ────────────────────────────────────────────────
client.once(Events.ClientReady, async () => {
  console.log('[BOT] Connecté :', client.user.tag);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('[BOT] Salon introuvable :', CHANNEL_ID);
      return;
    }
    console.log('[BOT] Salon :', channel.name);
    await envoyerPanel(channel);
    console.log('[BOT] ✅ Prêt !');
  } catch (e) {
    console.error('[BOT] Erreur démarrage :', e.message);
  }
});

client.login(TOKEN).catch(e => {
  console.error('[BOT] Connexion échouée :', e.message);
  if (e.message.includes('TOKEN_INVALID')) {
    console.error('[BOT] → Token invalide. Régénérez-le sur discord.com/developers');
  }
  process.exit(1);
});
