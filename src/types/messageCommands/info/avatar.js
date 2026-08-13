const { Client, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const config = require("../../../../config.json");

/**
 * @type {{ name: string, description: string, userPerms?: bigint[], execute: (message: import('discord.js').Message, args: string[], client: Client) => Promise<void> }}
 */
module.exports = {
    name: "avatar",
    description: "View your avatar or someone else's avatar",
    usage: `${config.prefix}avatar`,
    aliases: ["av"],

    /**
     * @param {import('discord.js').Message} message
     * @param {string[]} args
     * @param {Client} client
     */
    async execute(message, args, client) {
        const user = message.mentions.users.first() || message.author;
        const avatar = user.displayAvatarURL({ dynamic: true, size: 1024 });
    
        
        const emebed = new EmbedBuilder()
            .setTitle(`${user.username}'s Avatar`)
            .setImage(avatar)
            .setColor(client.color)
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        
        const button = new ButtonBuilder()
            .setLabel('Download')
            .setEmoji('📥')
            .setStyle(ButtonStyle.Link)
            .setURL(avatar);
        
        const row = new ActionRowBuilder()
            .addComponents(button);
        
        const reply = await message.reply({embeds: [embed], components: [row], fetchReply: true});
    }
};
