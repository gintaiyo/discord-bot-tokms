const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const Case = require('../../../models/caseSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a formal warning to a server member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the warning').setRequired(true)),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: 'You do not have permission to warn members.', flags: MessageFlags.Ephemeral });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot warn yourself.', flags: MessageFlags.Ephemeral });
        }

        if (targetUser.bot) {
            return interaction.reply({ content: 'You cannot warn bot accounts.', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (member) {
            if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ content: 'You cannot warn this user because they have a higher or equal role than you.', flags: MessageFlags.Ephemeral });
            }
        }

        if (mongoose.connection.readyState !== 1) {
            return interaction.reply({ content: 'Database connection is not established. Please try again later.', flags: MessageFlags.Ephemeral });
        }

        const pastInfractions = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id });
        const pastWarns = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id, action: 'warn' });

        const confirmId = `execute_warn_${interaction.id}`;
        const cancelId = `cancel_warn_${interaction.id}`;

        const confirmEmbed = new EmbedBuilder()
            .setColor('#FFAA00')
            .setAuthor({ name: `Warn ${targetUser.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`🚨 Confirm Warning Action`)
            .setDescription(`Please verify the details below. Pressing **Confirm** will log this warning and notify the user via direct message.`)
            .addFields(
                { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                { name: '📊 Historical Records', value: `\`${pastInfractions}\` total cases found | \`${pastWarns}\` past warnings.`, inline: false }
            )
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId(confirmId)
            .setEmoji('⚠️')
            .setLabel('Confirm Warning')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(cancelId)
            .setEmoji('❌')
            .setLabel('Cancel Warning')
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
                // Generate Case ID
                const caseNumber = Math.floor(100000 + Math.random() * 900000);

                // Send DM Notice to user
                const DMNotice = `⚠️ You have received a formal warning in **${interaction.guild.name}**.\n**Reason:**\n\`\`\`text\n${reason}\n\`\`\`\n*Case ID: #${caseNumber}*`;
                await targetUser.send({ content: DMNotice }).catch(() => null);

                // Save record to database
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
};