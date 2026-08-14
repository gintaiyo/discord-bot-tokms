const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const Case = require('../../../models/caseSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Revoke a ban for a user using their User ID')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option => 
            option.setName('user_id')
                .setDescription('The ID of the user to unban')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for unbanning the user')
                .setRequired(false)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const userId = interaction.options.getString('user_id').trim();
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: 'You do not have permission to unban members.', flags: MessageFlags.Ephemeral });
        }

        if (mongoose.connection.readyState !== 1) {
            return interaction.reply({ content: 'Database connection is not established. Please try again later.', flags: MessageFlags.Ephemeral });
        }

        // Fetch ban entry from guild to verify if user is banned
        const banEntry = await interaction.guild.bans.fetch(userId).catch(() => null);

        if (!banEntry) {
            return interaction.reply({ 
                content: `Could not find a ban record for ID \`${userId}\`. Please make sure the ID is correct and that the user is actually banned.`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        const bannedUser = banEntry.user;
        const pastInfractions = await Case.countDocuments({ guildId: interaction.guild.id, userId: bannedUser.id });

        const confirmId = `execute_unban_${interaction.id}`;
        const cancelId = `cancel_unban_${interaction.id}`;

        const confirmEmbed = new EmbedBuilder()
            .setColor('#FFAA00')
            .setAuthor({ name: `Unban ${bannedUser.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`🚨 Confirm Member Unban Action`)
            .setDescription(`Please verify the details below. Pressing **Confirm** will revoke this user's ban and allow them to rejoin.`)
            .addFields(
                { name: '👤 Target Account', value: `**User:** ${bannedUser.tag}\n**ID:** \`${bannedUser.id}\``, inline: true },
                { name: '⚖️ Original Ban Reason', value: `\`\`\`text\n${banEntry.reason || 'None provided'}\n\`\`\``, inline: false },
                { name: '📝 Unban Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                { name: '📊 Historical Records', value: `\`${pastInfractions}\` total cases found.`, inline: false }
            )
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId(confirmId)
            .setEmoji('✅')
            .setLabel('Confirm Unban')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(cancelId)
            .setEmoji('❌')
            .setLabel('Cancel Unban')
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
                // Execute unban
                try {
                    await interaction.guild.bans.remove(bannedUser.id, `${reason} | Unbanned by ${interaction.user.tag}`);
                } catch (err) {
                    console.error(err);
                    return i.update({ content: 'Failed to unban the user. Please check my permissions and role hierarchy.', embeds: [], components: [] });
                }

                // Save unban record to DB
                const caseNumber = Math.floor(100000 + Math.random() * 900000);
                const newCase = new Case({
                    guildId: interaction.guild.id,
                    userId: bannedUser.id,
                    caseId: caseNumber,
                    type: 'unban',
                    action: 'unban',
                    reason: reason,
                    moderatorId: interaction.user.id,
                    timestamp: new Date()
                });
                await newCase.save().catch(err => console.error('Database save error:', err));

                const unbanEmbed = new EmbedBuilder()
                    .setColor('#00ff2a')
                    .setAuthor({ name: `Unban Executed`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`✅ User Unbanned Successfully - Case No. ${caseNumber}`)
                    .setDescription(`The user **${bannedUser.tag}** has been unbanned from the server.`)
                    .addFields(
                        { name: '👤 Target Account', value: `**User:** ${bannedUser.tag}\n**ID:** \`${bannedUser.id}\``, inline: true },
                        { name: '📝 Reason Stated', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
                        { name: '📊 Historical Records', value: `\`${pastInfractions + 1}\` total cases found.`, inline: false }
                    )
                    .setTimestamp();

                await i.update({ embeds: [unbanEmbed], components: [] });
                collector.stop();
            } else if (i.customId === cancelId) {
                const abortEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Unban Action Cancelled`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`❌ Unban Action Aborted`)
                    .setDescription(`The unban action for **${bannedUser.tag}** has been cancelled.`)
                    .setTimestamp();

                await i.update({ embeds: [abortEmbed], components: [] });
                collector.stop();
            }
        });

        collector.on('end', async (collected, colReason) => {
            if (colReason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: `Unban Action Timeout`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`⏰ Unban Action Timed Out`)
                    .setDescription(`The unban action for **${bannedUser.tag}** has timed out due to inactivity.`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
            }
        });
    }
};