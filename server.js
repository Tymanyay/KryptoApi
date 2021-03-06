require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const got = require('got');
var differenceInMonths = require('date-fns/differenceInMonths');
var utcToZonedTime = require('date-fns-tz/utcToZonedTime');
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());

// async function makeRankResponse(members) {
// 	var string = '';
// 	for (var i = 0; i < members.length; i++) {
// 		let info = await getPlayerInfo(members[i]);
// 		console.log(info);
// 		if (info.currentRank !== info.correctRank) {
// 			string = string.concat(info.name + '\'s rank need to be changed to ' + info.correctRank + ', it is currently ' + info.currentRank + '\n');
// 		}
// 	}
// 	console.log(string);
// 	if (string !== undefined) return string;
// 	else return 'Everyone has correct ranks!';
// }

function search(nameKey, myArray) {
	for (var i = 0; i < myArray.length; i++) {
		if (myArray[i].uuid === nameKey) {
			return myArray[i];
		}
	}
}
// function numberWithCommas(x) {
// 	return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',');
// }
// function getGexp(expHistory) {
// 	return Object.values(expHistory).reduce(function(a, b) {
// 		return a + b;
// 	}, 0);
// }
async function getApi() {
	const body = await got.get(`https://api.hypixel.net/guild?key=${process.env.API_KEY}&id=5ef336138ea8c950b6cb73f2`).json();
	return body;
}
async function getPlayerInfo(item) {
	var info = {};
	var json = await got.get('https://api.ashcon.app/mojang/v2/user/' + item.uuid, {throwHttpErrors: false}).json();
	info.name = json.username;
	info.uuid = json.uuid;
	info.currentRank = item.rank;
	info.getRank = function (time) {
		let timeRank;
		if (time < 1) {
			timeRank = 'Trial';
		} else if (time >= 1 && time < 3) {
			timeRank = 'Trusted';
		} else if (time >= 3) {
			timeRank = 'Senior';
		}
		return timeRank;
	}
	let correctRank;
	let months = differenceInMonths(utcToZonedTime(new Date(), 'America/New_York'), utcToZonedTime(new Date(item.joined), 'America/New_York'));
	if (
		'Guild Master' === info.currentRank ||
		'Co-Owner' === info.currentRank ||
		'Officer' === info.currentRank
	) {
		correctRank = info.currentRank;
	} else if (months < 1) {
		correctRank = 'Trial';
	} else if (months >= 1 && months < 3) {
		correctRank = 'Trusted';
	} else if (months >= 3) {
		correctRank = 'Senior';
	}
	info.correctRank = correctRank;
	info.timeRank = info.getRank(months);
	info.months = months;
	info.string = "";
	if (info.currentRank !== info.correctRank) {
		info.string = info.string.concat(info.name + '\'s rank needs to be changed to ' + info.correctRank + ', it is currently ' + info.currentRank + '<br><br>');
	}
	return info;
}

app.get('/', (req, res) => {
	res.sendFile('/home/pi/kryptoapi/views/index.html');
});

app.get('/player', async (req, res) => {
	var id;
	var name;
	if (req.query.name === undefined) {
		return res.send(' Error: Must Specify player');
	}
	try {
		var json = await got('https://api.ashcon.app/mojang/v2/user/' + req.query.name).json()
	}
	catch {
		return res.send(' Error: Player does not exist');
	}
	id = json.uuid;
	name = json.username;
	var api = await getApi();
	var player = await search(id.replace("-", ""), api.guild.members);
	if (player === undefined) {
		return res.send(
			'Error: Player is not in the krypton guild.'
		);
	}
	var info = await getPlayerInfo(player);
	if (
		'Guild Master' === info.correctRank ||
		'Co-Owner' === info.correctRank ||
		'Officer' === info.correctRank
	) {
		res.send(
			'[' + info.correctRank + '] ' +
			name +
			'\'s guild stats:  Time Rank: ' +
			info.timeRank +
			', Months in guild: ' +
			info.months
		);
	} else if (info.correctRank === info.currentRank) {
		res.send(

			name +
			'\'s guild stats:  Rank: ' +
			info.correctRank +
			', Months in guild: ' +
			info.months
		);
	} else {
		res.send(

			name +
			'\'s guild stats:  Rank: ' +
			info.correctRank +
			' (Is currently ' +
			info.currentRank +
			', needs to be updated), Months in guild: ' +
			info.months
		);
	}

});
app.get('/ranks', async (req, res) => {
	var api = await getApi();
	var members = api.guild.members;
	var string = '';
	res.writeHead(200, '200 Found, Streaming response', {
		'Content-Type': 'text/html; charset=utf-8'
	});
	var promiseArray = [];
	for (var i = 0; i < members.length; i++) {
		promiseArray.push(getPlayerInfo(members[i]))
	}
	Promise.all(promiseArray).then((values) => {
		if (promiseArray.length === 0) {
			res.send('Everyone has correct ranks!');
		} else {
			for (var i = 0; i < values.length; i++) {
				res.write(values[i].string);
			}
			res.end();
		}
	})
});

// listen for requests :)
const listener = app.listen(80, () => {
	console.log('Your app is listening on port ' + listener.address().port);
});
