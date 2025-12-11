const { Client, Collection } = require('discord.js');

/**
 * @param { Client } client
 */
function loadMessageCommands(client) {
    const ascii = require('ascii-table');
    const fs = require('fs');

    const table = new ascii().setHeading('Message Cmd', 'Folder', 'Status');

    client.messageCommands = new Collection();

    const commandsFolder = fs.readdirSync('./src/types/messageCommands'); // e.g. ./src/types/messageCommands/util, fun, etc

    for (const folder of commandsFolder) {
        const commandFiles = fs
            .readdirSync(`./src/types/messageCommands/${folder}/`)
            .filter((file) => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(`../types/messageCommands/${folder}/${file}`);

            // expected export: { name, aliases?, description?, execute(message, args, client) {} }
            if (!command.name || typeof command.execute !== 'function') {
                table.addRow(file, folder, '❌');
                continue;
            }

            client.messageCommands.set(command.name, command);

            // optional: aliases
            if (command.aliases && Array.isArray(command.aliases)) {
                for (const alias of command.aliases) {
                    client.messageCommands.set(alias, command);
                }
            }

            table.addRow(command.name, folder, '✅');
        }
    }

    console.log(table.toString());
}

module.exports = { loadMessageCommands };
