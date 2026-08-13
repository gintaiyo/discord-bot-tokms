const { Client, Collection, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.MessageContent
        // Note: Add GatewayIntentBits.GuildPresences if you toggle Presence Intent ON in the Developer Portal
    ],
    partials: [
        Partials.User,
        Partials.Message,
        Partials.GuildMember,
        Partials.ThreadMember,
        Partials.GuildScheduledEvent,
        Partials.Reaction
    ]
});

//mongo
const { connectMongo } = require("./utils/mongo");
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

const prefix = ['.', '!']; 

/* Discord Handler */
const { loadEvents } = require('./handlers/EventHandler')
const { loadCommands } = require('./handlers/CommandHandler.js');
const { loadComponents } = require('./handlers/ComponentHandler');

/* Client Login */
client.login(client.config.token)
.then(() => {
    /* Start Handler */
    loadEvents(client);
    loadCommands(client);
    loadComponents(client);
})
