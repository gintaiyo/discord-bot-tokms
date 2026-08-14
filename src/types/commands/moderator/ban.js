const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

const mongoose = require('mongoose');
const Case = require('../../../models/caseSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the ban').setRequired(false)),
    
    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: 'You do not have permission to ban members.', flags: MessageFlags.Ephemeral });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot ban yourself.', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        // Role hierarchy checks (only applies if user is in the guild)
        if (member) {
            if (!member.bannable) {
                return interaction.reply({ content: 'I cannot ban this user. They may have a higher role than me or I lack permissions.', flags: MessageFlags.Ephemeral });
            }
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({ content: 'You cannot ban this user because they have a higher or equal role than you.', flags: MessageFlags.Ephemeral });
            }
        }

        if (mongoose.connection.readyState !== 1) {
            return interaction.reply({ content: 'Database connection is not established. Please try again later.', flags: MessageFlags.Ephemeral });
        }

        const pastInfractions = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id });
        const pastBans = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id, action: 'ban' });

        const confirmId = `execute_ban_${interaction.id}`;
        const cancelId = `cancel_ban_${interaction.id}`;

        const confirmEmbed = new EmbedBuilder()
            .setColor('#FFAA00')
            .setAuthor({ name: `Ban ${targetUser.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`🚨 Confirm Permanent Ban Action`)
            .setDescription(`Please verify the details below. Pressing **Confirm** will execute the ban.`)
            .addFields(
                { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                { name: '📊 Historical Records', value: `\`${pastInfractions}\` total cases found | \`${pastBans}\` past bans.`, inline: false }
            )
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId(confirmId)
            .setEmoji('✅')
            .setLabel('Confirm Ban')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(cancelId)
            .setEmoji('❌')
            .setLabel('Cancel Ban')
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
                // Try sending DM before banning (since banning cuts off mutual server DMs)
                const DMNotice = `You have been banned from **${interaction.guild.name}** for the following reason:\n\`\`\`text\n${reason}\n\`\`\``;
                await targetUser.send({ content: DMNotice }).catch(() => null);

                // Execute the ban (handles both in-guild members and ID bans)
                try {
                    await interaction.guild.bans.create(targetUser.id, {
                        reason: `${reason} | Banned by ${interaction.user.tag}`
                    });
                } catch (err) {
                    console.error(err);
                    return i.update({ content: 'Failed to ban the user. Please check my permissions and try again.', embeds: [], components: [] });
                }

                // Save to database
                const caseNumber = Math.floor(100000 + Math.random() * 900000);
                const newCase = new Case({
                    guildId: interaction.guild.id,
                    userId: targetUser.id,
                    caseId: caseNumber,
                    type: 'ban',
                    action: 'ban',
                    reason: reason,
                    moderatorId: interaction.user.id,
                    timestamp: new Date()
                });
                await newCase.save().catch(err => console.error('Database save error:', err));

                const banEmbed = new EmbedBuilder()
                    .setColor('#00ff2a')
                    .setAuthor({ name: `Ban Executed`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`✅ User Banned Successfully - Case No. ${caseNumber}`)
                    .setDescription(`The user **${targetUser.tag}** has been banned from the server.`)
                    .addFields(
                        { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                        { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                        { name: '📊 Historical Records', value: `\`${pastInfractions + 1}\` total cases found | \`${pastBans + 1}\` past bans.`, inline: false }
                    )
                    .setTimestamp();

                await i.update({ embeds: [banEmbed], components: [] });
                collector.stop();
            } else if (i.customId === cancelId) {
                const abortEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Ban Action Cancelled`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`❌ Ban Action Aborted`)
                    .setDescription(`The ban action for **${targetUser.tag}** has been cancelled.`)
                    .setTimestamp();

                await i.update({ embeds: [abortEmbed], components: [] });
                collector.stop();
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Ban Action Timeout`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`⏰ Ban Action Timed Out`)
                    .setDescription(`The ban action for **${targetUser.tag}** has timed out due to inactivity.`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
            }
        });
    }
};