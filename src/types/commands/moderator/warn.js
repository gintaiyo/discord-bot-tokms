const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const Case = require('../../../models/caseSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Manage server member warnings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Issue a formal warning to a server member')
                .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
                .addStringOption(option => option.setName('reason').setDescription('The reason for the warning').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View all warnings issued to a user')
                .addUserOption(option => option.setName('user').setDescription('The user to lookup').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a specific warning by its Case ID')
                .addIntegerOption(option => option.setName('case_id').setDescription('The 6-digit Case ID').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear all warnings for a specific user')
                .addUserOption(option => option.setName('user').setDescription('The user whose warnings will be wiped').setRequired(true))
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: 'You do not have permission to manage warnings.', flags: MessageFlags.Ephemeral });
        }

        if (mongoose.connection.readyState !== 1) {
            return interaction.reply({ content: 'Database connection is not established. Please try again later.', flags: MessageFlags.Ephemeral });
        }

        const subcommand = interaction.options.getSubcommand();

        //warn add
        if (subcommand === 'add') {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            if (targetUser.id === interaction.user.id) {
                return interaction.reply({ content: 'You cannot warn yourself.', flags: MessageFlags.Ephemeral });
            }

            if (targetUser.bot) {
                return interaction.reply({ content: 'You cannot warn bot accounts.', flags: MessageFlags.Ephemeral });
            }

            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (member && member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ content: 'You cannot warn this user because they have a higher or equal role than you.', flags: MessageFlags.Ephemeral });
            }

            const pastInfractions = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id });
            const pastWarns = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id, action: 'warn' });

            const confirmId = `exec_warn_${interaction.id}`;
            const cancelId = `canc_warn_${interaction.id}`;

            const confirmEmbed = new EmbedBuilder()
                .setColor('#FFAA00')
                .setAuthor({ name: `Warn ${targetUser.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`🚨 Confirm Warning Action`)
                .setDescription(`Please verify the details below. Pressing **Confirm** will log this warning and notify the user via DM.`)
                .addFields(
                    { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                    { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                    { name: '📊 Historical Records', value: `\`${pastInfractions}\` total cases found | \`${pastWarns}\` past warnings.`, inline: false }
                )
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(confirmId).setEmoji('⚠️').setLabel('Confirm Warning').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(cancelId).setEmoji('❌').setLabel('Cancel Warning').setStyle(ButtonStyle.Danger)
            );

            await interaction.reply({ embeds: [confirmEmbed], components: [actionRow] });
            const msg = await interaction.fetchReply();

            const collector = msg.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && (i.customId === confirmId || i.customId === cancelId),
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.customId === confirmId) {
                    const caseNumber = Math.floor(100000 + Math.random() * 900000);

                    const DMNotice = `⚠️ You have received a formal warning in **${interaction.guild.name}**.\n**Reason:**\n\`\`\`text\n${reason}\n\`\`\`\n*Case ID: #${caseNumber}*`;
                    await targetUser.send({ content: DMNotice }).catch(() => null);

                    const newCase = new Case({
                        guildId: interaction.guild.id,
                        userId: targetUser.id,
                        caseId: caseNumber,
                        type: 'warn',
                        action: 'warn',
                        reason: reason,
                        moderatorId: interaction.user.id,
                        timestamp: new Date()
                    });
                    await newCase.save().catch(err => console.error('Database save error:', err));

                    const warnSuccessEmbed = new EmbedBuilder()
                        .setColor('#FFAA00')
                        .setAuthor({ name: `Warning Issued`, iconURL: interaction.user.displayAvatarURL() })
                        .setTitle(`⚠️ User Warned Successfully - Case No. ${caseNumber}`)
                        .setDescription(`A formal warning has been registered for **${targetUser.tag}**.`)
                        .addFields(
                            { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                            { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                            { name: '📊 Historical Records', value: `\`${pastInfractions + 1}\` total cases found | \`${pastWarns + 1}\` past warnings.`, inline: false }
                        )
                        .setTimestamp();

                    await i.update({ embeds: [warnSuccessEmbed], components: [] });
                    collector.stop();
                } else if (i.customId === cancelId) {
                    const abortEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setAuthor({ name: `Warning Action Cancelled`, iconURL: interaction.user.displayAvatarURL() })
                        .setTitle(`❌ Warning Action Aborted`)
                        .setDescription(`The warning action for **${targetUser.tag}** has been cancelled.`)
                        .setTimestamp();

                    await i.update({ embeds: [abortEmbed], components: [] });
                    collector.stop();
                }
            });

            collector.on('end', async (collected, colReason) => {
                if (colReason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setAuthor({ name: `Warning Action Expired`, iconURL: interaction.user.displayAvatarURL() })
                        .setTitle(`⏰ Action Timed Out`)
                        .setDescription(`The warning prompt for **${targetUser.tag}** has timed out due to inactivity.`)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
                }
            });
        }

        //lists warns
        else if (subcommand === 'list') {
            const targetUser = interaction.options.getUser('user');
            const warns = await Case.find({ 
                guildId: interaction.guild.id, 
                userId: targetUser.id, 
                $or: [{ action: 'warn' }, { type: 'warn' }] 
            }).sort({ timestamp: -1 });

            if (!warns || warns.length === 0) {
                return interaction.reply({ 
                    content: `No warnings found for **${targetUser.tag}** (\`${targetUser.id}\`).`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const pageSize = 5;
            const totalPages = Math.ceil(warns.length / pageSize);
            let currentPage = 0;

            const generateEmbed = (page) => {
                const start = page * pageSize;
                const currentWarns = warns.slice(start, start + pageSize);

                const embed = new EmbedBuilder()
                    .setColor('#FFAA00')
                    .setAuthor({ name: `Warning History: ${targetUser.username}`, iconURL: targetUser.displayAvatarURL() })
                    .setTitle(`⚠️ Active Warnings: ${warns.length}`)
                    .setDescription(`Showing warning history for **${targetUser.tag}** (\`${targetUser.id}\`)\n${'―'.repeat(25)}`)
                    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
                    .setTimestamp();

                currentWarns.forEach(w => {
                    const modMention = w.moderatorId ? `<@${w.moderatorId}>` : 'Unknown Moderator';
                    const timeString = w.timestamp ? `<t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>` : 'Unknown Date';

                    embed.addFields({
                        name: `⚠️ Case #${w.caseId || 'N/A'}`,
                        value: `**Moderator:** ${modMention}\n**Date:** ${timeString}\n**Reason:** \`\`\`text\n${w.reason || 'No reason provided'}\n\`\`\``,
                        inline: false
                    });
                });

                return embed;
            };

            const generateButtons = (page) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_warn_${interaction.id}`)
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`next_warn_${interaction.id}`)
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
                filter: i => i.user.id === interaction.user.id && (i.customId === `prev_warn_${interaction.id}` || i.customId === `next_warn_${interaction.id}`),
                time: 120000
            });

            collector.on('collect', async i => {
                if (i.customId === `prev_warn_${interaction.id}` && currentPage > 0) {
                    currentPage--;
                } else if (i.customId === `next_warn_${interaction.id}` && currentPage < totalPages - 1) {
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

        //warn remove
        else if (subcommand === 'remove') {
            const caseId = interaction.options.getInteger('case_id');

            const targetCase = await Case.findOne({ 
                guildId: interaction.guild.id, 
                caseId: caseId, 
                $or: [{ action: 'warn' }, { type: 'warn' }] 
            });

            if (!targetCase) {
                return interaction.reply({ 
                    content: `No warning record found with Case ID \`#${caseId}\` in this server.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            await Case.deleteOne({ guildId: interaction.guild.id, caseId: caseId });

            const removeEmbed = new EmbedBuilder()
                .setColor('#00ff2a')
                .setAuthor({ name: `Warning Removed`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`🗑️ Warning Case #${caseId} Removed`)
                .setDescription(`Successfully removed the warning from <@${targetCase.userId}>'s records.`)
                .addFields(
                    { name: '👤 Target User', value: `<@${targetCase.userId}> (\`${targetCase.userId}\`)`, inline: true },
                    { name: '🛠️ Removed By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📝 Previous Reason', value: `\`\`\`text\n${targetCase.reason || 'No reason provided'}\n\`\`\``, inline: false }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [removeEmbed] });
        }

        //warn clear
        else if (subcommand === 'clear') {
            const targetUser = interaction.options.getUser('user');

            const warnCount = await Case.countDocuments({ 
                guildId: interaction.guild.id, 
                userId: targetUser.id, 
                $or: [{ action: 'warn' }, { type: 'warn' }] 
            });

            if (warnCount === 0) {
                return interaction.reply({ 
                    content: `**${targetUser.tag}** does not have any active warnings to clear.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const confirmId = `exec_clear_warn_${interaction.id}`;
            const cancelId = `canc_clear_warn_${interaction.id}`;

            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: `Clear All Warnings`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`🚨 Confirm Warning Wipe`)
                .setDescription(`Are you sure you want to permanently clear **all ${warnCount} warning(s)** for **${targetUser.tag}**? This action cannot be undone.`)
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(confirmId).setEmoji('🗑️').setLabel('Confirm Clear').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(cancelId).setEmoji('❌').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [confirmEmbed], components: [actionRow] });
            const msg = await interaction.fetchReply();

            const collector = msg.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && (i.customId === confirmId || i.customId === cancelId),
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.customId === confirmId) {
                    await Case.deleteMany({ 
                        guildId: interaction.guild.id, 
                        userId: targetUser.id, 
                        $or: [{ action: 'warn' }, { type: 'warn' }] 
                    });

                    const clearedEmbed = new EmbedBuilder()
                        .setColor('#00ff2a')
                        .setAuthor({ name: `Warnings Cleared`, iconURL: interaction.user.displayAvatarURL() })
                        .setTitle(`✅ All Warnings Wiped`)
                        .setDescription(`Successfully purged **${warnCount} warning(s)** for **${targetUser.tag}**.`)
                        .addFields(
                            { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                            { name: '🛠️ Moderator', value: `<@${interaction.user.id}>`, inline: true }
                        )
                        .setTimestamp();

                    await i.update({ embeds: [clearedEmbed], components: [] });
                    collector.stop();
                } else if (i.customId === cancelId) {
                    const abortEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle(`❌ Clear Action Aborted`)
                        .setDescription(`The warning clear action for **${targetUser.tag}** has been cancelled.`)
                        .setTimestamp();

                    await i.update({ embeds: [abortEmbed], components: [] });
                    collector.stop();
                }
            });

            collector.on('end', async (collected, colReason) => {
                if (colReason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle(`⏰ Action Timed Out`)
                        .setDescription(`The clear prompt for **${targetUser.tag}** has timed out due to inactivity.`)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
                }
            });
        }
    }
};