const {CLient, EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Get the bot invite link'),
    /**
     *  @param {ChatInputCommandInteraction} interaction
     *  @param {Client} client
     */                 

    async execute(interaction, client) {
        const inviteEmbed = new EmbedBuilder()
            .setTitle('Invite Me!')
            .setDescription('Click the button below to invite me to your server!')
            .setColor(client.color)
            .setTimestamp();

        const inviteButton = new ButtonBuilder()
            .setLabel('Invite Me')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);

        const row = new ActionRowBuilder()
            .addComponents(inviteButton);   

        await interaction.reply({ embeds: [inviteEmbed], components: [row] });
    }
};