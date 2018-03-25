const electron = require('electron');
const url = require('url');
const path = require('path');

const {app, BrowserWindow, Menu, ipcMain, dialog} = electron;

var OauthTwitter = require('electron-oauth-twitter');
var Twitter = require('twitter');
var fs = require('fs');
var twitterConn;
var accessToken;
var accessTokenSecret;
var twitterApi;
var currentTweets;

let mainWindow;

app.on('ready', function(){
	mainWindow = new BrowserWindow;
	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}));

	const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
	Menu.setApplicationMenu(null);
	mainWindow.setMenu(mainMenu);

	mainWindow.on('closed', function(){
		app.quit();
	});

});

ipcMain.on('app:authenticate', function(e,key,secret){
	//console.log('Auth with key: '+key+' and secret: '+secret+'.');
	console.log('Auth request...');
	mainWindow.webContents.send('add:text','#auth_info', 'Autentyfikacja w trakcie...');
	var twitterConn = new OauthTwitter({
	  key: key,
	  secret: secret
	});
	twitterConn.startRequest().then(function(result) {
	  accessToken = result.oauth_access_token;
	  accessTokenSecret = result.oauth_access_token_secret;
	  //console.log('Status', 'Token: ' + accessToken + '\nSecret: ' + accessTokenSecret);
	  mainWindow.webContents.send('add:text','#auth_info', 'Autentyfikacja udana!');
	  twitterApi = new Twitter({
		  consumer_key: key,
		  consumer_secret: secret,
		  access_token_key: accessToken,
		  access_token_secret: accessTokenSecret
		});
	}).catch(function(error) {
	  console.log(error);
	  mainWindow.webContents.send('add:text','#auth_info', 'Autentyfikacja nieudana! '+error.data);
	  console.log('Auth ok.');
	});
});

ipcMain.on('app:search', function(e,searchterm, lang, count){
	console.log('Search with term: '+searchterm);
	mainWindow.webContents.send('add:text','#search_info', 'Rozpoczynam szukanie...');
	if(verifyCred) {
		mainWindow.webContents.send('add:text','#search_info', 'Nawiązuję połączenie...');
		twitterApi.get('search/tweets',{q:searchterm, lang:lang, count:count}, function(error, tweets, response) {
		  if(error) {
		  	mainWindow.webContents.send('add:text','#search_info', 'Błąd!');
		  	throw error;
		  }
		  currentTweets = tweets;
		  mainWindow.webContents.send('add:text','#search_info', 'Szukanie zakończone! Wyniki: '+tweets.statuses.length);
		  /*tweets.statuses.forEach(function(tweet){
		  	console.log(tweet.text);
		  });*/
		  console.log('Search ok.');
		  updatePreview(tweets);
		  //console.log(tweets);  // The favorites. 
		  //console.log(response);  // Raw response object. 
		});
	} else {
		mainWindow.webContents.send('add:text','#search_info', 'Problem z autentyfikacją...');
	}
});

ipcMain.on('app:saveCsv', function(e){
	if(currentTweets==null) {
		mainWindow.webContents.send('add:text','#save_info', 'Brak tweetów!');
        return;
	}
	console.log('Saving CSV file');
	var toSave = jsonTweetsToCsv(currentTweets.statuses);
	saveFileWithDialog(toSave,'csv','CSV');
});

ipcMain.on('app:saveJson', function(e){
	if(currentTweets==null) {
		mainWindow.webContents.send('add:text','#save_info', 'Brak tweetów!');
        return;
	}
	console.log('Saving JSON file');
	var toSave = JSON.stringify(currentTweets.statuses);
	saveFileWithDialog(toSave,'json','JSON');
});

ipcMain.on('app:openExternal', function(e, link){
	console.log('Opening external link: '+link);
	shell.openExternal(link);
});

function pad2(number) {
     return (number < 10 ? '0' : '') + number
}

function jsonTweetsToCsv(jsonTweets) {
	var sep = ',';
	var csvTweets = 'id'+sep+'utworzono'+sep+'użytkownik'+sep+'tekst\n';
	jsonTweets.forEach(function(tweet){
		var text = '"'+tweet.text.replace(/[\r\n]/g, " ")+'"';
		var mydate = new Date(tweet.created_at);
		var date = mydate.getFullYear()+'-'+pad2(mydate.getMonth()+1)+'-'+pad2(mydate.getDate())+' '+pad2(mydate.getHours())+':'+pad2(mydate.getMinutes())+':'+pad2(mydate.getSeconds());
		csvTweets = csvTweets.concat(tweet.id+sep+date+sep+tweet.user.screen_name+sep+text+'\n');
	});
	return csvTweets;
}

function saveFileWithDialog(content, formatShort, formatLong) {
	dialog.showSaveDialog({ filters: [{ name: formatLong, extensions: [formatShort]}]},(fileName) => {
	    if (fileName === undefined){
	        mainWindow.webContents.send('add:text','#save_info', 'Plik nie został zapisany');
	        return;
	    }

	    // fileName is a string that contains the path and filename created in the save file dialog.  
	    fs.writeFile(fileName, content, (err) => {
	        if(err){
	            mainWindow.webContents.send('add:text','#save_info', 'Plik nie został zapisany: '+ err.message);
	        }         
	        mainWindow.webContents.send('add:text','#save_info', 'Plik został zapisany!');
	    });
	}); 
}

function updatePreview(tweets) {
	mainWindow.webContents.send('preview:update',tweets);
}

function verifyCred() {
	return twitter_connected;
}

// Help

function addSmallWindow(filename, name) {
	smallWindow = new BrowserWindow({
		width: 650,
		height: 300,
		title: name,
		parent: mainWindow,
		modal: true
	});
	smallWindow.setMenu(null);
	smallWindow.loadURL(url.format({
		pathname: path.join(__dirname, filename),
		protocol: 'file:',
		slashes: true
	}));
	smallWindow.on('close',function(){
		smallWindow = null;
	});
}

const mainMenuTemplate = [
	{
		label: 'O programie',
		click(){
			addSmallWindow('about.html','O programie');
		}
	},
	{
		label: 'Pomoc / kontakt',
		click(){
			addSmallWindow('contact.html','Pomoc / kontakt');
		}
	},
	{
		label: 'Licencja',
		click(){
			addSmallWindow('licence.html','Licencja');
		}
	}
];

if(process.platform=='darwin'){ mainMenuTemplate.unshift({}); }