const { Client, PermissionFlagsBits } = require('discord.js');
const config = require("../../../../config.json");

/**
 * @type {{ name: string, description: string, userPerms?: bigint[], execute: (message: import('discord.js').Message, args: string[], client: Client) => Promise<void> }}
 */
module.exports = {
    name: "ping",
    description: "Get bot\'s ping.",
    usage: `${config.prefix}ping`,
    aliases: ["p"],
    userPerms: [PermissionFlagsBits.Administrator],

    /**
     * @param {import('discord.js').Message} message
     * @param {string[]} args
     * @param {Client} client
     */
    async execute(message, args, client) {
        // Permission check (mirrors default member permissions)
        if (this.userPerms && !message.member.permissions.has(this.userPerms)) {
            return message.reply('You do not have permission to use this command.');
        }

        await message.reply(`**PONG! Api Ping is:** \`${client.ws.ping}ms\``);
    }
};
