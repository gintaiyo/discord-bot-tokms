const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const Case = require('../../../models/caseSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option => option.setName('user').setDescription('The user to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the kick').setRequired(false)),
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({ content: 'You do not have permission to kick members.', flags: 64 });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ content: 'That user is not currently in the server.', flags: 64 });
        }

        if (!member.kickable) {
            return interaction.reply({ content: 'I cannot kick this user. They may have a higher role than me or I lack permissions.', flags: 64 });
        }
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'You cannot kick this user because they have a higher or equal role than you.', flags: 64 });
        }
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot kick yourself.', flags: 64 });
        }

        if (mongoose.connection.readyState !== 1) {
            return interaction.reply({ content: 'Database connection is not established. Please try again later.', flags: 64 });
        }

        const pastInfractions = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id });
        const pastKicks = await Case.countDocuments({ guildId: interaction.guild.id, userId: targetUser.id, action: 'kick' });

        const confirmId = `execute_kick_${interaction.id}`;
        const cancelId = `cancel_kick_${interaction.id}`;

        const confirmEmbed = new EmbedBuilder()
            .setColor('#FFAA00')
            .setAuthor({ name: `Kick ${targetUser.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`🚨 Confirm Member Kick Action`)
            .setDescription(`Please verify the details below. Pressing **Confirm** will remove the user from the guild.`)
            .addFields(
                { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                { name: '📊 Historical Records', value: `\`${pastInfractions}\` total cases found | \`${pastKicks}\` past kicks.`, inline: false }
            )
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId(confirmId)
            .setEmoji('✅')
            .setLabel('Confirm Kick')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(cancelId)
            .setEmoji('❌')
            .setLabel('Cancel Kick')
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
                let DMNotice = `You have been kicked from **${interaction.guild.name}** for the following reason:\n\`\`\`text\n${reason}\n\`\`\``;
                await targetUser.send({ content: DMNotice }).catch(() => null);

                await member.kick(`${reason} | Kicked by ${interaction.user.tag}`).catch(err => {
                    console.error(err);
                    return i.update({ content: 'Failed to kick the user. Please check my permissions and try again.', embeds: [], components: [] });
                });

                const caseNumber = Math.floor(100000 + Math.random() * 900000);
                const newCase = new Case({
                    guildId: interaction.guild.id,
                    userId: targetUser.id,
                    caseId: caseNumber,
                    type: 'kick',
                    action: 'kick',
                    reason: reason,
                    moderatorId: interaction.user.id,
                    timestamp: new Date()
                });
                await newCase.save().catch(err => console.error(err));

                const kickEmbed = new EmbedBuilder()
                    .setColor('#00ff2a')
                    .setAuthor({ name: `Kick Executed`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`✅ User Kicked Successfully - Case No. ${caseNumber}`)
                    .setDescription(`The user **${targetUser.tag}** has been kicked from the server.`)
                    .addFields(
                        { name: '👤 Target Account', value: `**User:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\``, inline: true },
                        { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                        { name: '📊 Historical Records', value: `\`${pastInfractions + 1}\` total cases found | \`${pastKicks + 1}\` past kicks.`, inline: false }
                    )
                    .setTimestamp();

                await i.update({ embeds: [kickEmbed], components: [] });
                collector.stop();
            } else if (i.customId === cancelId) {
                const abortEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Kick Action Cancelled`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`❌ Kick Action Aborted`)
                    .setDescription(`The kick action for **${targetUser.tag}** has been cancelled.`)
                    .setTimestamp();

                await i.update({ embeds: [abortEmbed], components: [] });
                collector.stop();
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Kick Action Timeout`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`⏰ Kick Action Timed Out`)
                    .setDescription(`The kick action for **${targetUser.tag}** has timed out due to inactivity.`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
            }
        });
    }
};