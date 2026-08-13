const { Client, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require("../../../../config.json");

/**
 * @type {{ name: string, description: string, userPerms?: bigint[], execute: (message: import('discord.js').Message, args: string[], client: Client) => Promise<void> }}
 */
module.exports = {
    name: "botinfo",
    description: "View information about the bot.",
    usage: `${config.prefix}botinfo`,
    aliases: ["bi"],
    userPerms: [PermissionFlagsBits.Administrator],

    /**
     * @param {import('discord.js').Message} message
     * @param {string[]} args
     * @param {Client} client
     */
    async execute(message, args, client) {
        const embed = new EmbedBuilder()
                    .setTitle(`${client.user.username}'s Information`)
                    .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: 'Username', value: client.user.username, inline: true },
                        { name: 'Discriminator', value: `#${client.user.discriminator}`, inline: true },
                        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
                        { name: 'Version', value: `v${require('../../../../package.json').version}`, inline: true },
                        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
                        { name: 'Users', value: `${client.users.cache.size}`, inline: true },
                        { name: 'Created At', value: client.user.createdAt.toDateString(), inline: true }
                    )
                    .setColor(client.color)
                    .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                    .setTimestamp();
                await message.reply({ embeds: [embed] });
    }
};
