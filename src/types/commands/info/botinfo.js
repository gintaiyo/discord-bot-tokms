const { Client, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('View information about the bot'),
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });
        const embed = new EmbedBuilder()
            .setTitle(`${client.user.username}'s Information`)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: 'Username', value: client.user.username, inline: true },
                { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
                { name: 'Users', value: `${client.users.cache.size}`, inline: true },
            )
            .setColor(client.color)
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
}