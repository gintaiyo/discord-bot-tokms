const { Client, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription("View your avatar or someone else's avatar")
        .addUserOption(option => option.setName('user').setDescription('The user to view the avatar of')),
    
    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        // Fix 1: Fallback to interaction.user if no target option is selected
        const user = interaction.options.getUser('user') || interaction.user;
        const avatar = user.displayAvatarURL({ extension: 'png', size: 1024 });

        // Fix 2: Corrected variable typo (emebed -> embed)
        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Avatar`)
            .setImage(avatar)
            .setColor(client.color || 'Blurple')
            // Fix 3: Removed { dynamic: true } from author icon
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

        const button = new ButtonBuilder()
            .setLabel('Download')
            .setEmoji('📥')
            .setStyle(ButtonStyle.Link)
            .setURL(avatar);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};