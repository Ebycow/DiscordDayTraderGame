import 'dotenv/config'
import Datastore from 'nedb-promises';
import fetch from "node-fetch";

const TOKEN = process.env.TOKEN;

const GOOGLE_FINANCE_PRICE_UPDATES_URI = process.env.GOOGLE_FINANCE_PRICE_UPDATES_URI;

const FIRST_MONEY = process.env.FIRST_MONEY;
const FIRST_TICKET = process.env.FIRST_TICKET;

const db = Datastore.create('./userdata.db');

console.log("fetching googlefinance data.");
const response = await fetch(process.env.GOOGLE_FINANCE_PRICE_UPDATES_URI);
const text = await response.text();
const json = JSON.parse(text.slice(5));
const companyData = json["PriceUpdate"][0][0][0][17];
const COMPANY_NAME = companyData[1];
console.log("companyname: " + COMPANY_NAME);

async function getStockValue(){
    try {
        const response = await fetch(GOOGLE_FINANCE_PRICE_UPDATES_URI);
        const text = await response.text();
        const json = JSON.parse(text.slice(5));
        const companyData = json["PriceUpdate"][0][0][0][17];
        
        const stockValue = companyData[4];
    
        return stockValue;

    } catch (error) {
        throw "株価を取得できませんでした";

    }

}

async function getUser(userId) {

    const docs = await db.find({ userId: userId });
    let user = docs[0];

    if(!user){
        console.log("new user creating");
        user = await db.insert({userId : userId, money : FIRST_MONEY, ticket : FIRST_TICKET });

    }

    return user;

}

async function getAllUser(){
    return await db.find().exec();

}

async function buyTicket(userId, amount) {
    let user = await getUser(userId);

    try {
        const cost = await getStockValue()
        if(amount * cost <= user.money){
    
            const changedMoney = user.money - amount * cost;
            const changedTicket = Number(user.ticket) + amount;
    
            db.update({ userId: userId }, { userId: userId, money : changedMoney, ticket : changedTicket });
            return { user : (await getUser(userId)), stockValue : cost };
    
        } else {
            throw("お金が足りません");
    
        }

    } catch (error) {
        throw error;

    }

}

async function sellTicket(userId, amount) {
    let user = await getUser(userId);

    try {
        if(amount <= user.ticket){
        // if(true) {
            const value = await getStockValue();
    
            const changedMoney = user.money + amount * value;
            const changedTicket = Number(user.ticket)　-　amount;
    
            db.update({ userId: userId }, { userId: userId, money : changedMoney, ticket : changedTicket});
    
            return { user : (await getUser(userId)), stockValue : value };
    
        } else {
            throw("チケットが足りません");
    
        }

    } catch (error) {
        throw error;

    }

}

function createStatusText(user, stockValue, username){
    const assets = Number(user.ticket * stockValue) + Number(user.money);
    const text = `${COMPANY_NAME}の株価: ${stockValue}円 \n${username}さんの総資産: ${ assets }　(${ assets - FIRST_MONEY >= 0 ? `+${assets - FIRST_MONEY}` : `${assets - FIRST_MONEY}` }) \n持ち株数: ${user.ticket} \n所持金額: ${user.money}`;
    return text

}

import { Client, GatewayIntentBits, time } from 'discord.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'show') {
        try {
            const user = await getUser(interaction.user.id)
            const stockValue = await getStockValue()

            const text = createStatusText(user, stockValue, interaction.user.username);

            await interaction.reply({ content: text, ephemeral: true });
    
        } catch (error) {
            await interaction.reply(error)

        }

    }

    if(interaction.commandName === 'buy') {
        try {
            const buyAmount = interaction.options.getInteger('amount');
            const { user, stockValue } = await buyTicket(interaction.user.id, buyAmount)

            const text = createStatusText(user, stockValue, interaction.user.username);
            
            await interaction.reply(`${ buyAmount }株を${ buyAmount * stockValue }円で購入しました！:money_with_wings:`)
            await interaction.followUp({ content: text, ephemeral: true })

        } catch (error) {
            await interaction.reply(error)
            await interaction.followUp({ content: text, ephemeral: true })

        }
        
        
    }

    if(interaction.commandName === 'sell') {
        try {
            const sellAmount = interaction.options.getInteger('amount');
            const { user, stockValue } = await sellTicket(interaction.user.id, sellAmount)

            const text = createStatusText(user, stockValue, interaction.user.username);

            await interaction.reply(`${ sellAmount }株を${ sellAmount * stockValue }円で売却しました！:fire:`)
            await interaction.followUp({ content: text, ephemeral: true })

        } catch (error) {
            await interaction.reply(error)
            await interaction.followUp({ content: text, ephemeral: true })
            
        }
    }

    if(interaction.commandName === 'rank') {
        try {
            const stockvalue = await getStockValue()
            const users = await getAllUser();

            const status = await Promise.all((users.map(async (user) => {
                try {
                    const guilduser = await interaction.guild.members.fetch(user.userId);
                    let userName = guilduser.nickname;
                    if(userName == undefined){
                        userName = guilduser.displayName;

                    }

                    const assets = Number(user.ticket * stockvalue) + Number(user.money);

                    return [FIRST_MONEY - assets, (Number(user.ticket * stockvalue) + Number(user.money)), userName ? userName : "???" , `(${ assets - FIRST_MONEY >= 0 ? `+${assets - FIRST_MONEY}` : `${assets - FIRST_MONEY}` })`, user.ticket];

                } catch (error) {
                    return;

                }

            })));

    
            let text = `運用成績 (${ interaction.createdAt })\n----------\n`;
    
            for (const user of status.sort().reverse()) {
                    text += `${user[2]}様 : ${user[1]}円 ${user[3]} ${user[4]}株\n`

            }
    
            await interaction.reply(text)

        } catch (error) {
            await interaction.reply(error)
            
        }

    }

    if (interaction.commandName === 'spin') {
        const emjs = []
        const emojis = await interaction.guild.emojis.fetch()
    
        for (const e of emojis) {
            // GIF絵文字を除外
            if(!e[1].animated) {
                emjs.push(`<:${e[1].name}:${e[0]}>`)
            }
            
        }

        const spinner = []
        for (let index = 0; index < 3; index++) {
            spinner.push(emjs[Math.floor( Math.random() * emjs.length )])
        }
        let str = ""
        let count = 0
        await interaction.reply(":slot_machine: SLOT START!! :slot_machine:")
        
        for (const e of spinner) {
            str += e
            count++
            
            if(spinner[0] === spinner[1] && count == 3){
                
                await wait(10000)
            } else {
                await wait(1000)
            }
            
            await interaction.editReply(str)

        }

        if(spinner.every(v => v === spinner[0])) {
            await interaction.followUp(process.env.SLOT_TEXT)
        }

	}
    
});

client.login(TOKEN);