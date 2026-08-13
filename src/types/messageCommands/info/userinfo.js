const { Client, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require("../../../../config.json");

/**
 * @type {{ name: string, description: string, userPerms?: bigint[], execute: (message: import('discord.js').Message, args: string[], client: Client) => Promise<void> }}
 */
module.exports = {
    name: "userinfo",
    description: "View information about a user",
    usage: `${config.prefix}userinfo`,
    aliases: ["ui"],

    /**
     * @param {import('discord.js').Message} message
     * @param {string[]} args
     * @param {Client} client
     */
    async execute(message, args, client) {
        const user = message.mentions.users.first() || message.author;
        const member = message.guild.members.cache.get(user.id);

        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Information`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true })) 
              .addFields(
                { name: 'Username', value: user.username, inline: true },
                { name: 'Discriminator', value: `#${user.discriminator}`, inline: true },
                { name: 'ID', value: user.id, inline: true },
                { name: 'Status', value: member.presence ? member.presence.status : 'offline', inline: true },
                { name: 'Joined Server', value: member.joinedAt.toDateString(), inline: true },
                { name: 'Account Created', value: user.createdAt.toDateString(), inline: true }
            )
            .setColor(client.color)
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};
