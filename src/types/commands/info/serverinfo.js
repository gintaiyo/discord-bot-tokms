const { Client, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType, GuildVerificationLevel, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('View detailed metrics, security status, and information about the server'),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        await interaction.deferReply();

        const { guild } = interaction;
        const owner = await guild.fetchOwner().catch(() => null);

        const channels = guild.channels.cache;
        const totalChannels = channels.size;
        const textChannels = channels.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).size;
        const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;
        const forumChannels = channels.filter(c => c.type === ChannelType.GuildForum).size;
        const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

        const emojis = guild.emojis.cache;
        const staticEmojis = emojis.filter(e => !e.animated).size;
        const animatedEmojis = emojis.filter(e => e.animated).size;
        const stickersCount = guild.stickers.cache.size;

        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const verificationLevels = {
            [GuildVerificationLevel.None]: 'None (Unrestricted)',
            [GuildVerificationLevel.Low]: 'Low (Verified Email)',
            [GuildVerificationLevel.Medium]: 'Medium (Registered > 5m)',
            [GuildVerificationLevel.High]: 'High (Member > 10m)',
            [GuildVerificationLevel.VeryHigh]: 'Highest (Verified Phone)'
        };

        const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);
        const iconURL = guild.iconURL({ size: 2048 });
        const bannerURL = guild.bannerURL({ size: 2048 });
        const splashURL = guild.splashURL({ size: 2048 });

        const serverEmbed = new EmbedBuilder()
            .setColor(client.color || '#5865F2')
            .setAuthor({ name: guild.name, iconURL: iconURL || interaction.user.displayAvatarURL() })
            .setTitle('🏰 Guild Overview & Infrastructure')
            .setThumbnail(iconURL)
            .setDescription(guild.description ? `*${guild.description}*` : 'No server description provided.')
            .addFields(
                {
                    name: '📋 Core Information',
                    value: [
                        `**Server Name:** ${guild.name}`,
                        `**Server ID:** \`${guild.id}\``,
                        `**Owner:** ${owner ? `<@${owner.id}> (\`${owner.user.tag}\`)` : `\`${guild.ownerId}\``}`,
                        `**Created:** <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`,
                        `**Vanity URL:** ${guild.vanityURLCode ? `\`discord.gg/${guild.vanityURLCode}\`` : 'None'}`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: `👥 Members (${totalMembers.toLocaleString()})`,
                    value: [
                        `• 👤 **Humans:** \`${humanCount.toLocaleString()}\``,
                        `• 🤖 **Bots:** \`${botCount.toLocaleString()}\``,
                        `• 🎭 **Roles:** \`${guild.roles.cache.size.toLocaleString()}\``
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `📁 Channels (${totalChannels.toLocaleString()})`,
                    value: [
                        `• 💬 **Text / News:** \`${textChannels}\``,
                        `• 🔊 **Voice / Stage:** \`${voiceChannels}\``,
                        `• 📑 **Forums:** \`${forumChannels}\``,
                        `• 📂 **Categories:** \`${categories}\``
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🛡️ Security & Nitro Boosts',
                    value: [
                        `**Verification:** \`${verificationLevels[guild.verificationLevel] || 'Unknown'}\``,
                        `**Boost Status:** \`Level ${guild.premiumTier}\` (${guild.premiumSubscriptionCount || 0} Boosts)`,
                        `**Custom Emojis:** \`${emojis.size}\` (🖼️ \`${staticEmojis}\` | 🎞️ \`${animatedEmojis}\`)`,
                        `**Stickers:** \`${stickersCount}\``
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        if (bannerURL) {
            serverEmbed.setImage(bannerURL);
        }

        const actionRow = new ActionRowBuilder();

        if (iconURL) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setLabel('Server Icon')
                    .setStyle(ButtonStyle.Link)
                    .setURL(iconURL)
            );
        }

        if (bannerURL) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setLabel('Server Banner')
                    .setStyle(ButtonStyle.Link)
                    .setURL(bannerURL)
            );
        }

        if (splashURL) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setLabel('Invite Splash')
                    .setStyle(ButtonStyle.Link)
                    .setURL(splashURL)
            );
        }

        const components = actionRow.components.length > 0 ? [actionRow] : [];

        return interaction.editReply({ embeds: [serverEmbed], components });
    }
};