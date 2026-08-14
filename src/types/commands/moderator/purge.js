const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete messages with flexible filters')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Number of messages to delete (1 - 100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Select a filter type')
                .setRequired(false)
                .addChoices(
                    { name: 'All Messages', value: 'all' },
                    { name: 'Bots Only', value: 'bots' },
                    { name: 'Humans Only', value: 'humans' }
                )
        )
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Delete messages sent by a specific user only')
                .setRequired(false)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const amount = interaction.options.getInteger('amount');
        const filterType = interaction.options.getString('filter') || 'all';
        const targetUser = interaction.options.getUser('user');

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: 'You do not have permission to manage messages.', flags: MessageFlags.Ephemeral });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: 'I need the `Manage Messages` permission to delete messages.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const validMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);

            if (validMessages.size === 0) {
                return interaction.editReply({ 
                    content: 'No messages found that are eligible for deletion (messages older than 14 days cannot be bulk deleted).' 
                });
            }

            let filteredMessages = validMessages;

            if (targetUser) {
                filteredMessages = filteredMessages.filter(msg => msg.author.id === targetUser.id);
            } else if (filterType === 'bots') {
                filteredMessages = filteredMessages.filter(msg => msg.author.bot);
            } else if (filterType === 'humans') {
                filteredMessages = filteredMessages.filter(msg => !msg.author.bot);
            }

            const messagesToDelete = Array.from(filteredMessages.values()).slice(0, amount);

            if (messagesToDelete.length === 0) {
                return interaction.editReply({ 
                    content: 'No messages matched your specified filter criteria within the recent message history.' 
                });
            }

            const deleted = await interaction.channel.bulkDelete(messagesToDelete, true);

            // Determine filter label for embed
            let filterLabel = 'All Messages';
            if (targetUser) {
                filterLabel = `User: ${targetUser.tag}`;
            } else if (filterType === 'bots') {
                filterLabel = 'Bots Only';
            } else if (filterType === 'humans') {
                filterLabel = 'Humans Only';
            }

            const purgeEmbed = new EmbedBuilder()
                .setColor('#00ff2a')
                .setAuthor({ name: `Messages Cleared`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`🧹 Successfully Purged Messages`)
                .setDescription(`Deleted **${deleted.size}** message(s) from <#${interaction.channel.id}>.`)
                .addFields(
                    { name: '🎯 Requested Target', value: `\`${amount}\` messages`, inline: true },
                    { name: '🔍 Filter Mode', value: `\`${filterLabel}\``, inline: true },
                    { name: '🛠️ Moderator', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setFooter({ text: 'Note: Messages older than 14 days cannot be purged.' })
                .setTimestamp();

            return interaction.editReply({ embeds: [purgeEmbed] });

        } catch (error) {
            console.error('Purge error:', error);
            return interaction.editReply({ content: 'An error occurred while attempting to purge messages. Please check my permissions and try again.' });
        }
    }
};