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

async function getRandomArtist(genre) {
  const getRandomLetter = () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    return letters[Math.floor(Math.random() * letters.length)];
  };

  try {
    while (true) {
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${getRandomLetter()}&type=artist&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${app.locals.spotifyToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`HTTP error! status: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      
      let popularArtists;
      if (genre != null) {
        popularArtists = searchData.artists.items.filter(artist => 
          artist.popularity >= 75 && artist.genres.some(g => g.toLowerCase().includes(genre.toLowerCase())));
      } else {
        popularArtists = searchData.artists.items.filter(artist => artist.popularity >= 75);
      }
      
      if (popularArtists.length > 0) {
        const randomArtist = popularArtists[Math.floor(Math.random() * popularArtists.length)];
        console.log(`Found artist: ${randomArtist.name} (popularity: ${randomArtist.popularity})`);
        return randomArtist;
      }
    }
  } catch (error) {
    console.error("Error fetching random artist:", error);
    return null;
  }
}

async function getSong(artistId) {
  try {
    const tracksResponse = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      {
        headers: {
          'Authorization': `Bearer ${app.locals.spotifyToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!tracksResponse.ok) {
      throw new Error(`HTTP error! status: ${tracksResponse.status}`);
    }

    const tracksData = await tracksResponse.json();
    
    if (tracksData.tracks.length > 0) {
      return tracksData.tracks[0];
    }
    return null;
  } catch (error) {
    console.error("Error fetching artist's top track:", error);
    return null;
  }
}

async function getRandomSong() {
  try {
    const artist = await getRandomArtist();
    if (!artist) {
      throw new Error("Failed to find a random artist");
    }

    const song = await getSong(artist.id);
    if (!song) {
      throw new Error("Failed to find a song for the artist");
    }

    return song;
  } catch (error) {
    console.error("Error in getRandomSong:", error);
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
    console.log(`Web server is running at http://localhost:${portNumber}/login`);
    
    promptUser();
  });
}

/**express shit**/
app.get("/login", (req, res) => {
  res.render('logIn');
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  
  try {
      const user = await db.collection('users').findOne({ username: username });
      
      if (!user) {
          return res.render('logIn', { error: 'Invalid username or password' });
      }
      
      if (password !== user.password) {
          return res.render('logIn', { error: 'Invalid username or password' });
      }
      
      res.redirect('/home');
  } catch (error) {
      console.error('Login error:', error);
      res.render('logIn', { error: 'An error occurred during login' });
  }
});

app.get("/signup", (req, res) => {
  res.render('signUp');
});

app.post("/signup", async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  
  try {
      if (password !== confirmPassword) {
          return res.render('signUp', { error: 'Passwords do not match' });
      }
      const existingUser = await db.collection('users').findOne({ username: username });
      if (existingUser) {
          return res.render('signUp', { error: 'Username already exists' });
      }
      
      await db.collection('users').insertOne({
          username: username,
          password: password,
          playlist: [],
          created_at: new Date()
      });
      
      res.redirect('/login');
  } catch (error) {
      console.error('Signup error:', error);
      res.render('signUp', { error: 'An error occurred during signup' });
  }
});

app.get("/home", async (req, res) => {
  const song = await getRandomSong("rnb");
  res.render('home', { song: song });
});

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