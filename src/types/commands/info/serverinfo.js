const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('View information about the server'),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const { guild } = interaction;

        const totalChannels = guild.channels.cache.size;
        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;
        const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const createdTimestamp = `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:R>`;
        const premiumTier = guild.premiumTier === 0 ? 'None' : `Tier ${guild.premiumTier}`;

        const serverEmbed = new EmbedBuilder()
            .setColor('#1C315E')
            .setTitle(`${guild.name} Information`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || interaction.client.user.displayAvatarURL())
            .addFields(
                { name: 'Owner', value: `**Owner:** <@${guild.ownerId}>\n**Realm ID:** \`${guild.id}\`\n**Created:** ${createdTimestamp}`, inline: false },
                { name: 'Users', value: `**Total Citizens:** ${totalMembers}\n• Humans: ${humanCount}\n• Automated Units: ${botCount}`, inline: true },
                { name: 'Channels', value: `**Total Channels:** ${totalChannels}\n• Category: ${categories}\n• Text: ${textChannels}\n• Voice: ${voiceChannels}`, inline: true },
                { name: 'Roles', value: `**Roles Registered:** ${guild.roles.cache.size}\n**Custom Emojis:** ${guild.emojis.cache.size}\n**Server Boost Level:** ${premiumTier} (${guild.premiumSubscriptionCount} Boosts)`, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [serverEmbed] });
    }
};