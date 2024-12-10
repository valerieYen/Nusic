require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const bodyParser = require("body-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { request } = require("http");
const username = encodeURIComponent(process.env.MONGO_DB_USERNAME);
const password = encodeURIComponent(process.env.MONGO_DB_PASSWORD);
const dbName = process.env.MONGO_DB_NAME;
const uri = `mongodb+srv://${username}:${password}@cluster0.allbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:false}));

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db(dbName);

    // Test the connection
    await db.command({ ping: 1 });
    console.log("Database ping successful!");

    return true;
  } catch (error) {
    console.error("Database connection error:", error);
    return false;
  }
}

let collection;
async function connectToCollection() {
  try {
    await client.connect();
    collection = db.collection(collectionName);

    return true;
  } catch (error) {
    console.error("Collection connection error:", error);
    return false;
  }
}

if (process.argv.length != 3) {
  process.stdout.write("Usage summerCampServer.js PORT_NUMBER");
  process.exit(1);
}

const portNumber = parseInt(process.argv[2]);
if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
  console.error("Please provide a valid port number (1-65535)");
  process.exit(1);
}

async function startServer() {
  const connected = await connectToDatabase();
  if (!connected) {
    console.error("Failed to connect to database. Exiting...");
    process.exit(1);
  }

  app.listen(portNumber, () => {
    console.log(`Web server is running at http://localhost:${portNumber}`);
    
    promptUser();
  });
}

function promptUser() {
  process.stdin.on("readable", function () {
    const dataInput = process.stdin.read();
    if (dataInput !== null) {
      const command = dataInput.trim();
      if (command.toLowerCase() === "stop") {
          client.close().then(() => {
            process.exit(0);
          });
      } else {
        process.stdout.write("Invalid command: " + dataInput);
        process.stdout.write(prompt);
        process.stdin.resume();
      }
    } else {
      process.stdout.write(prompt);
      process.stdin.resume();
    }
  });
}

startServer().catch(console.error);
const prompt = "Type stop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.setEncoding("utf8");