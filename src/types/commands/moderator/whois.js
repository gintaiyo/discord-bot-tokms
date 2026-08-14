const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const Case = require('../../../models/caseSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('View detailed account information, roles, and moderation summary for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to lookup (defaults to yourself)')
                .setRequired(false)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        let stats = { warn: 0, timeout: 0, kick: 0, ban: 0, total: 0 };

        if (mongoose.connection.readyState === 1) {
            const cases = await Case.find({ guildId: interaction.guild.id, userId: targetUser.id }).lean();
            if (cases && cases.length > 0) {
                stats.total = cases.length;
                stats.warn = cases.filter(c => (c.action || c.type) === 'warn').length;
                stats.timeout = cases.filter(c => (c.action || c.type) === 'timeout' || (c.action || c.type) === 'mute').length;
                stats.kick = cases.filter(c => (c.action || c.type) === 'kick').length;
                stats.ban = cases.filter(c => (c.action || c.type) === 'ban').length;
            }
        }

        const keyPermissions = [];
        if (member) {
            if (member.permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push('Administrator');
            else {
                if (member.permissions.has(PermissionFlagsBits.ManageGuild)) keyPermissions.push('Manage Server');
                if (member.permissions.has(PermissionFlagsBits.ManageRoles)) keyPermissions.push('Manage Roles');
                if (member.permissions.has(PermissionFlagsBits.ManageChannels)) keyPermissions.push('Manage Channels');
                if (member.permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push('Ban Members');
                if (member.permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push('Kick Members');
                if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) keyPermissions.push('Timeout Members');
                if (member.permissions.has(PermissionFlagsBits.ManageMessages)) keyPermissions.push('Manage Messages');
            }
        }

        let rolesDisplay = 'Not in server';
        if (member) {
            const roles = member.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`);

            rolesDisplay = roles.length > 0 
                ? (roles.length > 10 ? `${roles.slice(0, 10).join(', ')} +${roles.length - 10} more` : roles.join(', '))
                : 'None';
        }

        const accountCreatedTimestamp = Math.floor(targetUser.createdTimestamp / 1000);
        const joinedTimestamp = member ? Math.floor(member.joinedTimestamp / 1000) : null;

        const infoEmbed = new EmbedBuilder()
            .setColor(member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor : '#2B2D31')
            .setAuthor({ name: `${targetUser.username} (${targetUser.id})`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle(`👤 User & Moderation Profile`)
            .addFields(
                {
                    name: '📋 Account Details',
                    value: [
                        `**Tag:** ${targetUser.tag}`,
                        `**ID:** \`${targetUser.id}\``,
                        `**Bot:** ${targetUser.bot ? '✅ Yes' : '❌ No'}`,
                        `**Created:** <t:${accountCreatedTimestamp}:D> (<t:${accountCreatedTimestamp}:R>)`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🏰 Server Membership',
                    value: member ? [
                        `**Nickname:** ${member.nickname ? `\`${member.nickname}\`` : 'None'}`,
                        `**Joined Server:** <t:${joinedTimestamp}:D> (<t:${joinedTimestamp}:R>)`,
                        `**Boosting:** ${member.premiumSince ? `Since <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : 'No'}`,
                        `**Highest Role:** ${member.roles.highest.id !== interaction.guild.id ? `<@&${member.roles.highest.id}>` : '@everyone'}`,
                        `**Key Permissions:** \`${keyPermissions.length > 0 ? keyPermissions.join(', ') : 'Standard User'}\``
                    ].join('\n') : '⚠️ *This user is currently not a member of this server.*',
                    inline: false
                },
                {
                    name: `📊 Moderation History (${stats.total} Total Cases)`,
                    value: [
                        `⚠️ **Warns:** \`${stats.warn}\``,
                        `⏱️ **Timeouts/Mutes:** \`${stats.timeout}\``,
                        `👢 **Kicks:** \`${stats.kick}\``,
                        `🔨 **Bans:** \`${stats.ban}\``
                    ].join(' | '),
                    inline: false
                },
                {
                    name: `🎭 Roles [${member ? member.roles.cache.size - 1 : 0}]`,
                    value: rolesDisplay,
                    inline: false
                }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        return interaction.reply({ embeds: [infoEmbed] });
    }
};