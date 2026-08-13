const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for the ban').setRequired(false)),
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }
        if (!member.bannable) {
            return interaction.reply({ content: 'I cannot ban this user. They might have a higher role than me or I do not have ban permissions.', ephemeral: true });
        } else {
            const embed = new EmbedBuilder()
                .setTitle(`User Banned`)
                .setDescription(`**User:** ${user.username}\n**Reason:** ${reason}`)
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setColor(client.color)
                .setTimestamp();
            await member.ban({ reason: reason });
            return interaction.reply({ embeds: [embed] });
        }
        
    }
}