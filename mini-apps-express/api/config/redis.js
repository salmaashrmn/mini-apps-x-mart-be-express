const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    db: 0
  });
  client.connect();
  client.on('connect', ()=> {
    console.log("client conected");
  })
  
  client.on('ready', ()=> {
    console.log("client ready");
  })
