const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option => option.setName('user').setDescription('The user to unban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the unban').setRequired(false))
        ,
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const bannedUsers = await interaction.guild.bans.fetch();
        if (!bannedUsers.has(user.id)) {
            return interaction.reply({ content: 'User is not banned.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`User Unbanned`)
            .setDescription(`**User:** ${user.username}\n**Reason:** ${reason}`)
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
            .setColor(client.color)
            .setTimestamp();

        await interaction.guild.bans.remove(user.id, reason);
        return interaction.reply({ embeds: [embed] });
    }
}