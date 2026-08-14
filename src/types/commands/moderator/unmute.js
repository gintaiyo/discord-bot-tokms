const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const Case = require('../../../models/caseSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove the timeout/mute from a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => option.setName('user').setDescription('The user to unmute').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for unmuting').setRequired(false)),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: 'You do not have permission to unmute members.', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'That user is not currently in the server.', flags: MessageFlags.Ephemeral });
        }

        // Check if the user is actually timed out
        if (!member.isCommunicationDisabled()) {
            return interaction.reply({ content: `**${targetUser.tag}** is not currently muted/timed out.`, flags: MessageFlags.Ephemeral });
        }

        if (!member.moderatable) {
            return interaction.reply({ content: 'I cannot manage this user. They may have a higher role than me or I lack permissions.', flags: MessageFlags.Ephemeral });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'You cannot unmute this user because they have a higher or equal role than you.', flags: MessageFlags.Ephemeral });
        }

        if (mongoose.connection.readyState !== 1) {
            return interaction.reply({ content: 'Database connection is not established. Please try again later.', flags: MessageFlags.Ephemeral });
        }

        const pastInfractions = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id });

        const confirmId = `execute_unmute_${interaction.id}`;
        const cancelId = `cancel_unmute_${interaction.id}`;

        const confirmEmbed = new EmbedBuilder()
            .setColor('#FFAA00')
            .setAuthor({ name: `Unmute ${targetUser.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`🚨 Confirm Member Unmute Action`)
            .setDescription(`Please verify the details below. Pressing **Confirm** will lift the timeout and restore this member's chat and voice permissions.`)
            .addFields(
                { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                { name: '⏳ Timeout Ends', value: `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`, inline: true },
                { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                { name: '📊 Historical Records', value: `\`${pastInfractions}\` total cases found.`, inline: false }
            )
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId(confirmId)
            .setEmoji('✅')
            .setLabel('Confirm Unmute')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(cancelId)
            .setEmoji('❌')
            .setLabel('Cancel Unmute')
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
                // Send DM notice before removing timeout
                const DMNotice = `You have been unmuted in **${interaction.guild.name}**.\n**Reason:**\n\`\`\`text\n${reason}\n\`\`\``;
                await targetUser.send({ content: DMNotice }).catch(() => null);

                // Remove the timeout
                try {
                    await member.timeout(null, `${reason} | Unmuted by ${interaction.user.tag}`);
                } catch (err) {
                    console.error(err);
                    return i.update({ content: 'Failed to unmute the user. Please check my permissions and role hierarchy.', embeds: [], components: [] });
                }

                // Save record to database
                const caseNumber = Math.floor(100000 + Math.random() * 900000);
                const newCase = new Case({
                    guildId: interaction.guild.id,
                    userId: targetUser.id,
                    caseId: caseNumber,
                    type: 'unmute',
                    action: 'unmute',
                    reason: reason,
                    moderatorId: interaction.user.id,
                    timestamp: new Date()
                });
                await newCase.save().catch(err => console.error('Database save error:', err));

                const unmuteSuccessEmbed = new EmbedBuilder()
                    .setColor('#00ff2a')
                    .setAuthor({ name: `Unmute Executed`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`✅ User Unmuted Successfully - Case No. ${caseNumber}`)
                    .setDescription(`The timeout for **${targetUser.tag}** has been removed.`)
                    .addFields(
                        { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                        { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                        { name: '📊 Historical Records', value: `\`${pastInfractions + 1}\` total cases found.`, inline: false }
                    )
                    .setTimestamp();

                await i.update({ embeds: [unmuteSuccessEmbed], components: [] });
                collector.stop();
            } else if (i.customId === cancelId) {
                const abortEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Unmute Action Cancelled`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`❌ Unmute Action Aborted`)
                    .setDescription(`The unmute action for **${targetUser.tag}** has been cancelled.`)
                    .setTimestamp();

                await i.update({ embeds: [abortEmbed], components: [] });
                collector.stop();
            }
        });

        collector.on('end', async (collected, colReason) => {
            if (colReason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Unmute Action Expired`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`⏰ Action Timed Out`)
                    .setDescription(`The unmute prompt for **${targetUser.tag}** has timed out due to inactivity.`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
            }
        });
    }
};