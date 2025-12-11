/* Bot discord.js setup */
const { Client, Collection, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
const { User, GuildMember, GuildScheduledEvent, Message, Reaction, ThreadMember } = Partials
const { Guilds, GuildMembers, GuildMessages, GuildVoiceStates, DirectMessages, GuildMessageReactions, GuildEmojisAndStickers, GuildWebhooks, GuildIntegrations, MessageContent, GuildPresences } = GatewayIntentBits;
const client = new Client({ intents: [Guilds, GuildMembers, GuildMessages, GuildVoiceStates, DirectMessages, GuildMessageReactions, GuildEmojisAndStickers, GuildWebhooks, GuildIntegrations, MessageContent, GuildPresences], partials: [User, Message, GuildMember, ThreadMember, GuildScheduledEvent, Reaction] });
const fs = require('fs');

//mongo
const { connectMongo } = require("./utils/mongo");
const Afk = require('./models/Afk.js'); // <-- your model
client.AfkCollection = Afk;
connectMongo();


/* Client Config */
client.config = require('../config.json')
client.color = parseInt(client.config.color.replace("#", "0x"))

/* Client Collections */
client.voiceGenerator = new Collection();
client.commands = new Collection();
client.modals = new Collection();
client.buttons = new Collection();
client.selectMenus = new Collection();

const prefix = ['T!', 't!']; // Replace with your desired prefix

/* Discord Handler */
const { loadEvents } = require('./handlers/EventHandler')
const { loadCommands } = require('./handlers/CommandHandler.js');
const { loadComponents } = require('./handlers/ComponentHandler');
const { loadMessageCommands } = require('./handlers/MsgCommandHandler');

/* Client Login */
client.login(client.config.token)
.then(() => {
    /* Start Handler */
    loadEvents(client);
    loadCommands(client);
    loadComponents(client);
    loadMessageCommands(client);
})

client.on('messageCreate', async (message) => {
    if (!message.guild) return;
    if (message.author.bot) return;

    // find which prefix (if any) was used
    const usedPrefix = prefix.find((p) => message.content.startsWith(p));
    if (!usedPrefix) return;

    const args = message.content.slice(usedPrefix.length).trim().split(/\s+/);
    const cmdName = args.shift().toLowerCase();

    const command = client.messageCommands.get(cmdName);
    if (!command) return;

    // optional: permission check like before
    if (command.userPerms && !message.member.permissions.has(command.userPerms)) {
        return message.reply('You do not have permission to use this command.');
    }

    try {
        await command.execute(message, args, client);
    } catch (err) {
        console.error(err);
        message.reply('there was an error executing that command.');
    }
});

// after you create the client
client.snipes = new Map();

// messageDelete listener
client.on('messageDelete', (message) => {
  if (!message.guild || !message.author || message.author.bot) return;

  const channelId = message.channel.id;
  client.snipes.set(channelId, {
    content: message.content || '(no content)',
    authorTag: message.author.username,
    authorAvatar: message.author.displayAvatarURL({ size: 256 }),
    createdAt: message.createdAt,
    attachment: message.attachments.first()?.url || null,
  });
});

