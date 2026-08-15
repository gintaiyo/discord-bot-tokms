const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const Case = require('../../../models/caseSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modstats')
        .setDescription('View moderation activity statistics for a moderator or the entire staff team')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => 
            option.setName('moderator')
                .setDescription('The staff member to inspect (leave blank for staff leaderboard)')
                .setRequired(false)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: 'You do not have permission to view staff statistics.', flags: MessageFlags.Ephemeral });
        }

        if (mongoose.connection.readyState !== 1) {
            return interaction.reply({ content: 'Database connection is not established. Please try again later.', flags: MessageFlags.Ephemeral });
        }

        const targetMod = interaction.options.getUser('moderator');

        // Individual moderator stats
        if (targetMod) {
            const cases = await Case.find({ guildId: interaction.guild.id, moderatorId: targetMod.id }).lean();

            if (!cases || cases.length === 0) {
                return interaction.reply({ 
                    content: `No moderation logs found for **${targetMod.tag}** (\`${targetMod.id}\`) in this server.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const now = Date.now();
            const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
            const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

            const casesLast7Days = cases.filter(c => new Date(c.timestamp).getTime() > sevenDaysAgo).length;
            const casesLast30Days = cases.filter(c => new Date(c.timestamp).getTime() > thirtyDaysAgo).length;

            const breakdown = {
                warn: cases.filter(c => (c.action || c.type) === 'warn').length,
                timeout: cases.filter(c => (c.action || c.type) === 'timeout').length,
                kick: cases.filter(c => (c.action || c.type) === 'kick').length,
                ban: cases.filter(c => (c.action || c.type) === 'ban').length,
                unban: cases.filter(c => (c.action || c.type) === 'unban').length,
                unmute: cases.filter(c => (c.action || c.type) === 'unmute').length
            };

            const latestCase = cases.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            const latestActionTime = latestCase ? `<t:${Math.floor(new Date(latestCase.timestamp).getTime() / 1000)}:R>` : 'N/A';

            const modStatsEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setAuthor({ name: `Moderator Audit: ${targetMod.username}`, iconURL: targetMod.displayAvatarURL({ dynamic: true }) })
                .setThumbnail(targetMod.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle(`📊 Staff Activity Metrics`)
                .setDescription(`Showing all recorded actions executed by **${targetMod.tag}** (\`${targetMod.id}\`).`)
                .addFields(
                    {
                        name: '📈 Total Volume',
                        value: [
                            `**Lifetime Cases:** \`${cases.length}\``,
                            `**Past 30 Days:** \`${casesLast30Days}\``,
                            `**Past 7 Days:** \`${casesLast7Days}\``,
                            `**Last Active:** ${latestActionTime}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '📋 Action Breakdown',
                        value: [
                            `⚠️ **Warns:** \`${breakdown.warn}\``,
                            `⏱️ **Timeouts:** \`${breakdown.timeout}\``,
                            `👢 **Kicks:** \`${breakdown.kick}\``,
                            `🔨 **Bans:** \`${breakdown.ban}\``,
                            `🔓 **Unbans:** \`${breakdown.unban}\``,
                            `🔊 **Unmutes:** \`${breakdown.unmute}\``
                        ].join('\n'),
                        inline: true
                    }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();

            return interaction.reply({ embeds: [modStatsEmbed] });
        }

        //server-wide leaderboard
        const leaderboardData = await Case.aggregate([
            { $match: { guildId: interaction.guild.id } },
            { $group: { _id: '$moderatorId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        if (!leaderboardData || leaderboardData.length === 0) {
            return interaction.reply({ content: 'No moderation activity records found for this server.', flags: MessageFlags.Ephemeral });
        }

        const totalServerCases = await Case.countDocuments({ guildId: interaction.guild.id });

        const medals = ['🥇', '🥈', '🥉'];
        const leaderboardList = leaderboardData.map((entry, index) => {
            const rank = medals[index] || `\`#${index + 1}\``;
            const percentage = ((entry.count / totalServerCases) * 100).toFixed(1);
            return `${rank} <@${entry._id}> — **${entry.count}** cases (\`${percentage}%\`)`;
        }).join('\n');

        const leaderboardEmbed = new EmbedBuilder()
            .setColor('#FFAA00')
            .setAuthor({ name: `${interaction.guild.name} Staff Audit`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTitle(`🏆 Staff Moderation Leaderboard`)
            .setDescription(`**Total Server Cases:** \`${totalServerCases}\`\n${'―'.repeat(25)}\n${leaderboardList}`)
            .setFooter({ text: 'Use /modstats [moderator] to view an individual staff report.' })
            .setTimestamp();

        return interaction.reply({ embeds: [leaderboardEmbed] });
    }
};