import 'dotenv/config'
import { SlashCommandBuilder, Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import fetch from "node-fetch";

console.log("fetching googlefinance data.");
const response = await fetch(process.env.GOOGLE_FINANCE_PRICE_UPDATES_URI);
const text = await response.text();
const json = JSON.parse(text.slice(5));
const companyData = json["PriceUpdate"][0][0][0][17];
const companyName = companyData[1];
console.log("companyname: " + companyName);

console.log("registering commands.");
const commands = [
	new SlashCommandBuilder().setName('buy').setDescription(`${ companyName }の株を買います`).addIntegerOption(option => {return option.setName('amount').setDescription("購入数を指定します").setRequired(true)}).toJSON(),
	new SlashCommandBuilder().setName('sell').setDescription(`${ companyName }の株を売ります`).addIntegerOption(option => {return option.setName('amount').setDescription("売却数を指定します").setRequired(true)}).toJSON(),
	new SlashCommandBuilder().setName('show').setDescription('成績を表示します').toJSON(),
	new SlashCommandBuilder().setName('rank').setDescription('ランキングを表示します').toJSON(),
	new SlashCommandBuilder().setName('spin').setDescription('社運を天に任せます').toJSON()
]

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);