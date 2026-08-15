const { Client, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription("View your avatar or someone else's avatar in full resolution")
        .addUserOption(option => option.setName('user').setDescription('The user to view the avatar of').setRequired(false)),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        await interaction.deferReply();

        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        const globalAvatarURL = user.displayAvatarURL({ size: 2048 });
        const serverAvatarURL = member?.avatar ? member.avatarURL({ size: 2048 }) : null;
        const isAnimated = user.avatar?.startsWith('a_') || member?.avatar?.startsWith('a_');

        const getFormatLinks = (targetURL) => {
            const base = targetURL.split('?')[0].replace(/\.(png|jpg|jpeg|webp|gif)$/, '');
            const links = [
                `[PNG](${base}.png?size=2048)`,
                `[JPG](${base}.jpg?size=2048)`,
                `[WEBP](${base}.webp?size=2048)`
            ];
            if (isAnimated) links.push(`[GIF](${base}.gif?size=2048)`);
            return links.join(' • ');
        };

        let currentView = serverAvatarURL ? 'server' : 'global';

        const buildEmbed = (view) => {
            const isServer = view === 'server';
            const activeURL = isServer ? serverAvatarURL : globalAvatarURL;
            const titlePrefix = isServer ? `${user.username}'s Server Avatar` : `${user.username}'s Global Avatar`;

            return new EmbedBuilder()
                .setColor(member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor : client.color || '#5865F2')
                .setAuthor({ name: `${user.tag} (${user.id})`, iconURL: user.displayAvatarURL() })
                .setTitle(`🖼️ ${titlePrefix}`)
                .setDescription(`**Download Formats:**\n${getFormatLinks(activeURL)}`)
                .setImage(activeURL)
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();
        };

        const buildButtons = (view) => {
            const row = new ActionRowBuilder();

            if (serverAvatarURL) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`avatar_global_${interaction.id}`)
                        .setLabel('Global Avatar')
                        .setEmoji('🌐')
                        .setStyle(view === 'global' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(view === 'global'),
                    new ButtonBuilder()
                        .setCustomId(`avatar_server_${interaction.id}`)
                        .setLabel('Server Avatar')
                        .setEmoji('🏰')
                        .setStyle(view === 'server' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(view === 'server')
                );
            }

            const activeURL = view === 'server' ? serverAvatarURL : globalAvatarURL;
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('Open in Browser')
                    .setEmoji('🔗')
                    .setStyle(ButtonStyle.Link)
                    .setURL(activeURL)
            );

            return row;
        };

        const initialRow = buildButtons(currentView);
        await interaction.editReply({ 
            embeds: [buildEmbed(currentView)], 
            components: [initialRow] 
        });

        if (!serverAvatarURL) return;

        const msg = await interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && (i.customId === `avatar_global_${interaction.id}` || i.customId === `avatar_server_${interaction.id}`),
            time: 60000
        });

        collector.on('collect', async i => {
            currentView = i.customId.includes('global') ? 'global' : 'server';
            await i.update({
                embeds: [buildEmbed(currentView)],
                components: [buildButtons(currentView)]
            });
        });

        collector.on('end', async () => {
            const expiredRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Open in Browser')
                    .setEmoji('🔗')
                    .setStyle(ButtonStyle.Link)
                    .setURL(currentView === 'server' ? serverAvatarURL : globalAvatarURL)
            );
            await interaction.editReply({ components: [expiredRow] }).catch(() => null);
        });
    }
};