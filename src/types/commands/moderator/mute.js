const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const ms = require('ms'); // Ensure you have 'ms' installed: npm i ms
const Case = require('../../../models/caseSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Temporarily timeout (mute) a member in the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => option.setName('user').setDescription('The user to timeout').setRequired(true))
        .addStringOption(option => option.setName('duration').setDescription('Duration of timeout (e.g., 60s, 10m, 1h, 1d, 7d)').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the timeout').setRequired(false)),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const durationInput = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: 'You do not have permission to timeout members.', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'That user is not currently in the server.', flags: MessageFlags.Ephemeral });
        }

        if (!member.moderatable) {
            return interaction.reply({ content: 'I cannot timeout this user. They may have a higher role than me or I lack permissions.', flags: MessageFlags.Ephemeral });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'You cannot timeout this user because they have a higher or equal role than you.', flags: MessageFlags.Ephemeral });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot timeout yourself.', flags: MessageFlags.Ephemeral });
        }

        // Convert duration string to milliseconds
        const durationMs = ms(durationInput);
        const maxDurationMs = 28 * 24 * 60 * 60 * 1000; // Discord limit: 28 days

        if (!durationMs || isNaN(durationMs) || durationMs <= 0) {
            return interaction.reply({ content: 'Please specify a valid duration format (e.g., `5m`, `1h`, `1d`).', flags: MessageFlags.Ephemeral });
        }

        if (durationMs > maxDurationMs) {
            return interaction.reply({ content: 'Timeout duration cannot exceed 28 days.', flags: MessageFlags.Ephemeral });
        }

        if (mongoose.connection.readyState !== 1) {
            return interaction.reply({ content: 'Database connection is not established. Please try again later.', flags: MessageFlags.Ephemeral });
        }

        const pastInfractions = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id });
        const pastTimeouts = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id, action: 'timeout' });

        const confirmId = `execute_timeout_${interaction.id}`;
        const cancelId = `cancel_timeout_${interaction.id}`;

        const confirmEmbed = new EmbedBuilder()
            .setColor('#FFAA00')
            .setAuthor({ name: `Timeout ${targetUser.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`🚨 Confirm Member Timeout Action`)
            .setDescription(`Please verify the details below. Pressing **Confirm** will restrict this member from sending messages, reacting, and joining voice channels.`)
            .addFields(
                { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                { name: '⏱️ Duration', value: `\`${ms(durationMs, { long: true })}\``, inline: true },
                { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                { name: '📊 Historical Records', value: `\`${pastInfractions}\` total cases found | \`${pastTimeouts}\` past timeouts.`, inline: false }
            )
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId(confirmId)
            .setEmoji('✅')
            .setLabel('Confirm Timeout')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(cancelId)
            .setEmoji('❌')
            .setLabel('Cancel Timeout')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.reply({ embeds: [confirmEmbed], components: [actionRow] });

        const msg = await interaction.fetchReply();

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && (i.customId === confirmId || i.customId === cancelId),
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === confirmId) {
                // Send DM before applying timeout
                const DMNotice = `You have been timed out in **${interaction.guild.name}** for **${ms(durationMs, { long: true })}**.\n**Reason:**\n\`\`\`text\n${reason}\n\`\`\``;
                await targetUser.send({ content: DMNotice }).catch(() => null);

                // Apply timeout
                try {
                    await member.timeout(durationMs, `${reason} | Timed out by ${interaction.user.tag}`);
                } catch (err) {
                    console.error(err);
                    return i.update({ content: 'Failed to timeout the member. Please check my permissions and role hierarchy.', embeds: [], components: [] });
                }

                // Save record in database
                const caseNumber = Math.floor(100000 + Math.random() * 900000);
                const newCase = new Case({
                    guildId: interaction.guild.id,
                    userId: targetUser.id,
                    caseId: caseNumber,
                    type: 'timeout',
                    action: 'timeout',
                    duration: durationMs,
                    reason: reason,
                    moderatorId: interaction.user.id,
                    timestamp: new Date()
                });
                await newCase.save().catch(err => console.error('Database save error:', err));

                const timeoutSuccessEmbed = new EmbedBuilder()
                    .setColor('#00ff2a')
                    .setAuthor({ name: `Timeout Executed`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`✅ User Timed Out Successfully - Case No. ${caseNumber}`)
                    .setDescription(`The user **${targetUser.tag}** has been timed out for **${ms(durationMs, { long: true })}**.`)
                    .addFields(
                        { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                        { name: '⏱️ Duration', value: `\`${ms(durationMs, { long: true })}\``, inline: true },
                        { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                        { name: '📊 Historical Records', value: `\`${pastInfractions + 1}\` total cases found | \`${pastTimeouts + 1}\` past timeouts.`, inline: false }
                    )
                    .setTimestamp();

                await i.update({ embeds: [timeoutSuccessEmbed], components: [] });
                collector.stop();
            } else if (i.customId === cancelId) {
                const abortEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Timeout Action Cancelled`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`❌ Timeout Action Aborted`)
                    .setDescription(`The timeout action for **${targetUser.tag}** has been cancelled.`)
                    .setTimestamp();

                await i.update({ embeds: [abortEmbed], components: [] });
                collector.stop();
            }
        });

        collector.on('end', async (collected, colReason) => {
            if (colReason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Timeout Action Expired`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`⏰ Action Timed Out`)
                    .setDescription(`The timeout prompt for **${targetUser.tag}** has timed out due to inactivity.`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
            }
        });
    }
};