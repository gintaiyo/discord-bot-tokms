const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const Case = require('../../../models/caseSchema');

const typeIcons = {
    warn: '⚠️',
    timeout: '⏱️',
    unmute: '🔊',
    kick: '👢',
    ban: '🔨',
    unban: '🔓'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription('Manage server moderation cases')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View moderation case history for a user')
                .addUserOption(option => option.setName('user').setDescription('The user to lookup').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit the reason of a specific moderation case')
                .addIntegerOption(option => option.setName('case_id').setDescription('The 6-digit Case ID').setRequired(true))
                .addStringOption(option => option.setName('reason').setDescription('The updated reason').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Permanently delete a moderation case from the records')
                .addIntegerOption(option => option.setName('case_id').setDescription('The 6-digit Case ID').setRequired(true))
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: 'You do not have permission to manage moderation cases.', flags: MessageFlags.Ephemeral });
        }

        if (mongoose.connection.readyState !== 1) {
            return interaction.reply({ content: 'Database connection is not established. Please try again later.', flags: MessageFlags.Ephemeral });
        }

        const subcommand = interaction.options.getSubcommand();

        //view case by that user
        if (subcommand === 'view') {
            const targetUser = interaction.options.getUser('user');
            const cases = await Case.find({ guildId: interaction.guild.id, userId: targetUser.id }).sort({ timestamp: -1 });

            if (!cases || cases.length === 0) {
                return interaction.reply({ 
                    content: `No moderation history found for **${targetUser.tag}** (\`${targetUser.id}\`).`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const stats = {
                warn: cases.filter(c => (c.action || c.type) === 'warn').length,
                timeout: cases.filter(c => (c.action || c.type) === 'timeout').length,
                kick: cases.filter(c => (c.action || c.type) === 'kick').length,
                ban: cases.filter(c => (c.action || c.type) === 'ban').length
            };

            const pageSize = 5;
            const totalPages = Math.ceil(cases.length / pageSize);
            let currentPage = 0;

            const generateEmbed = (page) => {
                const start = page * pageSize;
                const currentCases = cases.slice(start, start + pageSize);
                const overviewStats = `⚠️ \`${stats.warn}\` Warns | ⏱️ \`${stats.timeout}\` Timeouts | 👢 \`${stats.kick}\` Kicks | 🔨 \`${stats.ban}\` Bans`;

                const embed = new EmbedBuilder()
                    .setColor('#2B2D31')
                    .setAuthor({ name: `Infraction History: ${targetUser.username}`, iconURL: targetUser.displayAvatarURL() })
                    .setTitle(`📊 Infraction Records (${cases.length} Total)`)
                    .setDescription(`**User:** ${targetUser.tag} (\`${targetUser.id}\`)\n${overviewStats}\n${'―'.repeat(25)}`)
                    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
                    .setTimestamp();

                currentCases.forEach(c => {
                    const rawAction = (c.action || c.type || 'unknown').toLowerCase();
                    const icon = typeIcons[rawAction] || '📝';
                    const actionLabel = rawAction.toUpperCase();
                    const modMention = c.moderatorId ? `<@${c.moderatorId}>` : 'Unknown Moderator';
                    const timeString = c.timestamp ? `<t:${Math.floor(new Date(c.timestamp).getTime() / 1000)}:R>` : 'Unknown Date';
                    
                    let extraInfo = '';
                    if (c.duration) {
                        const minutes = Math.round(c.duration / 60000);
                        extraInfo = ` | **Duration:** \`${minutes}m\``;
                    }

                    embed.addFields({
                        name: `${icon} Case #${c.caseId || 'N/A'} | [${actionLabel}]`,
                        value: `**Moderator:** ${modMention}\n**Date:** ${timeString}${extraInfo}\n**Reason:** \`\`\`text\n${c.reason || 'No reason provided'}\n\`\`\``,
                        inline: false
                    });
                });

                return embed;
            };

            const generateButtons = (page) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_page_${interaction.id}`)
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`next_page_${interaction.id}`)
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1)
                );
            };

            if (totalPages === 1) {
                return interaction.reply({ embeds: [generateEmbed(0)] });
            }

            await interaction.reply({ 
                embeds: [generateEmbed(currentPage)], 
                components: [generateButtons(currentPage)] 
            });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && (i.customId === `prev_page_${interaction.id}` || i.customId === `next_page_${interaction.id}`),
                time: 120000
            });

            collector.on('collect', async i => {
                if (i.customId === `prev_page_${interaction.id}` && currentPage > 0) {
                    currentPage--;
                } else if (i.customId === `next_page_${interaction.id}` && currentPage < totalPages - 1) {
                    currentPage++;
                }

                await i.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [generateButtons(currentPage)]
                });
            });

            collector.on('end', async () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev_disabled').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('next_disabled').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                await interaction.editReply({ components: [disabledRow] }).catch(() => null);
            });
        }

       //edit case
        else if (subcommand === 'edit') {
            const caseId = interaction.options.getInteger('case_id');
            const newReason = interaction.options.getString('reason');

            const targetCase = await Case.findOne({ guildId: interaction.guild.id, caseId: caseId });

            if (!targetCase) {
                return interaction.reply({ content: `No case found with ID \`#${caseId}\` in this server.`, flags: MessageFlags.Ephemeral });
            }

            const oldReason = targetCase.reason || 'No reason provided';
            targetCase.reason = newReason;
            await targetCase.save();

            const editEmbed = new EmbedBuilder()
                .setColor('#FFAA00')
                .setAuthor({ name: `Case Updated`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`📝 Case #${caseId} Modified`)
                .setDescription(`Successfully updated the record for <@${targetCase.userId}>.`)
                .addFields(
                    { name: '📋 Action Type', value: `\`${(targetCase.action || targetCase.type).toUpperCase()}\``, inline: true },
                    { name: '👤 Target User', value: `<@${targetCase.userId}> (\`${targetCase.userId}\`)`, inline: true },
                    { name: '🛠️ Edited By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '⬅️ Previous Reason', value: `\`\`\`text\n${oldReason}\n\`\`\``, inline: false },
                    { name: '➡️ Updated Reason', value: `\`\`\`text\n${newReason}\n\`\`\``, inline: false }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [editEmbed] });
        }

        //delete case
        else if (subcommand === 'delete') {
            const caseId = interaction.options.getInteger('case_id');

            const targetCase = await Case.findOne({ guildId: interaction.guild.id, caseId: caseId });

            if (!targetCase) {
                return interaction.reply({ content: `No case found with ID \`#${caseId}\` in this server.`, flags: MessageFlags.Ephemeral });
            }

            await Case.deleteOne({ guildId: interaction.guild.id, caseId: caseId });

            const deleteEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: `Case Removed`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`🗑️ Case #${caseId} Deleted`)
                .setDescription(`The moderation case has been permanently removed from the records.`)
                .addFields(
                    { name: '📋 Action Type', value: `\`${(targetCase.action || targetCase.type).toUpperCase()}\``, inline: true },
                    { name: '👤 Target User', value: `<@${targetCase.userId}> (\`${targetCase.userId}\`)`, inline: true },
                    { name: '🛠️ Removed By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📝 Case Reason Was', value: `\`\`\`text\n${targetCase.reason || 'No reason provided'}\n\`\`\``, inline: false }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [deleteEmbed] });
        }
    }
};