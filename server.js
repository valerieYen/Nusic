require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const bodyParser = require("body-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { request } = require("http");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const username = encodeURIComponent(process.env.MONGO_DB_USERNAME);
const password = encodeURIComponent(process.env.MONGO_DB_PASSWORD);
const dbName = process.env.MONGO_DB_NAME;
const uri = `mongodb+srv://${username}:${password}@cluster0.allbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const spotifyId = encodeURIComponent(process.env.SPOTIFY_CLIENT_ID);
const spotifySecret = encodeURIComponent(process.env.SPOTIFY_CLIENT_SECRET);

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:false}));
app.use(express.static('public'));



/**MongoDB shtuffs**/
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



/**Spotify Shtuffs**/
async function authenticateSpotify() {
  try {
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      headers: {
        'Authorization': 'Basic ' + (Buffer.from(spotifyId + ':' + spotifySecret).toString('base64'))
      },
      form: {
        grant_type: 'client_credentials'
      },
      json: true
    };

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + (Buffer.from(spotifyId + ':' + spotifySecret).toString('base64')),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Spotify authentication successful!");
    return data.access_token;

  } catch (error) {
    console.error("Spotify authentication error:", error);
    return null;
  }
}



/**Other Shtuffs**/
if (process.argv.length != 3) {
  process.stdout.write("Usage server.js PORT_NUMBER");
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

  const spotifyToken = await authenticateSpotify();
  if (!spotifyToken) {
    console.error("Failed to authenticate with Spotify. Exiting...");
    process.exit(1);
  }
  app.locals.spotifyToken = spotifyToken;

  app.listen(portNumber, () => {
    console.log(`Web server is running at http://localhost:${portNumber}/home`);
    
    promptUser();
  });
}

/**express shit**/
app.get("/home", (req, res) => {
  res.render('home');
})

/**FOR TESTING USE ONLY, we will build this and will not need to do this**/
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