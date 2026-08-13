const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option => option.setName('user').setDescription('The user to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the kick').setRequired(false)),
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
        if (!member.kickable) {
            return interaction.reply({ content: 'I cannot kick this user. They might have a higher role than me or I do not have kick permissions.', ephemeral: true });
        } else {
            const embed = new EmbedBuilder()
                .setTitle(`User Kicked`)
                .setDescription(`**User:** ${user.username}\n**Reason:** ${reason}`)
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setColor(client.color)
                .setTimestamp();
            await member.kick(reason);
            return interaction.reply({ embeds: [embed] });
        }
        
    }
}