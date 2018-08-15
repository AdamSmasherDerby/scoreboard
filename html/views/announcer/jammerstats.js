$(initialize);

var period = null;
var jam = null;
var jammerList = {};
var starPass = {1: false, 2: false};
var spOffset = {1: 0, 2: 0};

function initialize() {
	jammerList = {};
	
	WS.Connect();
	WS.AutoRegister();

	$.each([1, 2], function(idx, t) {
		WS.Register([ 'ScoreBoard.Team(' + t + ').Name' ], function(k,v) {
			$('.Team' + t + ' .TeamName').html(v);
		}); 
		WS.Register([ 'ScoreBoard.Team(' + t + ').AlternateName' ]);
		WS.Register([ 'ScoreBoard.Team(' + t + ').Color' ], function(k, v) { 
			processScoreboardColors(k,v,t);		
		});
		
		WS.Register( [ 'ScoreBoard.Team(' + t + ').Skater' ] ); 
		WS.Register( [ 'ScoreBoard.Team(' + t + ').Position(Jammer)' ]);
		WS.Register( [ 'ScoreBoard.Team(' + t + ').Position(Pivot)' ]);
		WS.Register([ 'ScoreBoard.Team(' + t + ').JamScore' ], function(k,v) {
			processCurrentJamScore(k,v,t);
		})
		WS.Register( [ 'ScoreBoard.Team(' + t + ').StarPass'], function(k,v) {
			processCurrentJamStarPass(k,v,t);
		});
		WS.Register( [ 'ScoreBoard.Team(' + t + ').LeadJammer'], function(k,v) {
			processCurrentJamLead(k,v,t);
		});		
		
	});
	
	WS.Register( [ 'ScoreBoard.Clock(Period).Number' ], function(k, v) { period = v; });
	WS.Register( [ 'ScoreBoard.Clock(Jam).Number' ], function(k, v) { 
		jam = v;
		newJam(period, jam);
	});


	WS.Register( [ 'Game' ], function(k,v){
		processGameEvent(k,v);
	})
	

}


function processCurrentJamScore(k, v, t){
// For a "jam score" event for the current jam:
	var id = ''
	var period = WS.state['ScoreBoard.Clock(Period).Number'];
	var jam = WS.state['ScoreBoard.Clock(Jam).Number'];
	var prefix = 'Game.Period(' + period + ').Jam(' + jam + ').Team(' + t + ')';
	
	console.log(k, v, t)
	// Find the ID for the jammer for the current jam
	if(starPass[t] == false) {
		id = WS.state[prefix + '.Skater(Jammer).Id'];
	} else {
		id = WS.state[prefix + '.Skater(Pivot).Id'];
	}
	if (id == null || id == undefined || jammerList[id] == undefined) { return; }

	// Move the current jam score to "current jam" for the jammer.
	jammerList[id].currentScore = v - spOffset[t];
	
	var scoreCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + 
			jammerList[id].number + '] .Pts');
	scoreCell.html(jammerList[id].priorScore + jammerList[id].currentScore);
	
}

function processCurrentJamLead(k, v, t){
// For a "Lead" event for the current jam, increment the counter for the current jammer
	console.log(k,v,t)
	var id = WS.state['ScoreBoard.Team(' + t + ').Position(Jammer).Skater']
	if (id==undefined){ return; } // can't do anything if no jammer is entered
								  // Also resolves the "nolead" issued at the end of a jam

	if (v == "Lead") { 
		jammerList[id].lead += 1;
	} else if (v == "NoLead") {
		jammerList[id].lead -= 1;
	}
	var leadCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + 
			jammerList[id].number + '] .Lead');
	leadCell.html(jammerList[id].lead);
	updateLeadPct(t, id);
}

//LeadPct
function processCurrentJamStarPass(k, v, t){
// For a star pass event for the current jam
	if (v == 'False') { return; }
	var p = WS.state['ScoreBoard.Clock(Period).Number'];
	var j = WS.state['ScoreBoard.Clock(Jam).Number'];
	var prefix = 'Game.Period(' + p + ').Jam(' + j + ').Team(' + t + ')';
		
	// Set the star pass flag for team t
	starPass[t] = true;
	
	var oldJammer = WS.state[prefix + '.Skater(Jammer).Id'];
	var newJammer = WS.state[prefix + '.Skater(Pivot).Id'];
	
	// Add the current points for the old jammer to their prior points
	jammerList[oldJammer].priorScore += jammerList[oldJammer].currentScore;
	spOffset[t] = jammerList[oldJammer].currentScore;
	jammerList[oldJammer].currentScore = 0;
	
	// Add the pivot to the skater list if not present
	if (newJammer != null && newJammer != undefined){
		addJammer(t, newJammer);
		incrementJams(t, newJammer);
	}
	
}

function newJam(period, jam) {
// Trigger at the start of a new jam
	var id = '';
	var priorJam = 0;
	var priorJammer = '';
	starPass = {1: false, 2: false};
	spOffset = {1: 0 , 2: 0 };
	
	$.each([1,2], function(idx, t) {
		if (jam == 1) {
			priorJam = jamsInPeriod(period - 1);
			priorJammer = WS.state['Game.Period(' + (period - 1) + ').Jam(' + priorJam + ').Team(' + t + ').Skater(Jammer).Id'];
		} else {
			priorJam = jam - 1;
			priorJammer = WS.state['Game.Period(' + period + ').Jam(' + priorJam + ').Team(' + t + ').Skater(Jammer).Id'];
		}
		if (priorJammer == undefined || priorJammer == null || jammerList[priorJammer] == undefined) { return; }
		jammerList[priorJammer].priorScore += jammerList[priorJammer].currentScore;
		jammerList[priorJammer].currentScore = 0;
	})
	
	
	// Add the current jammer to the list.
	$.each([1, 2], function(idx, t) {
		id = WS.state['ScoreBoard.Team(' + t + ').Position(Jammer).Skater'];
		if (id == null) { return; }
		addJammer(t,id);
	})

}

var starPassRE = /Game\.Period\((\d)\)\.Jam\((\d)\)\.Team\((\d)\)\.StarPass/;
var leadRE = /Game\.Period\((\d)\)\.Jam\((\d)\)\.Team\((\d)\)\.LeadJammer/;

function processGameEvent(k, v) { 
	// Game events should be used to recreate the data in the event the screen is reloaded, or loaded after
	// the game starts.
	
	console.log(k,v);
		
	if (k == 'Game.Period(1).Jam(1).PeriodClockStart'){
	// Will trigger once per reload.
		
		jammerList = {};
		resetTable();
		
		// Add jammers for prior periods
		var currentJam = WS.state['ScoreBoard.Clock(Jam).Number']
		var currentPeriod = WS.state['ScoreBoard.Clock(Period).Number']
		if (currentPeriod == 2){
		// If this is the second period, add all the jammers for the first period
			var j = 1;
			while (WS.state['Game.Period(1).Jam(' + j + ').Jam'] != undefined){
				processPriorJam(1,j);
				j++;
			}			
		}
		for (var j = 1; j <= currentJam; j++){
		// Add all the prior jammers for the current period
			processPriorJam(currentPeriod, j);
		}
	}
		
}

function processPriorJam(p,j) {
// Given a period and a jam number, add both jammers to the list if they 
// are entered and not in the list.  Also update statistics.  This is for jammers prior to
// the current jam
	
	var id;
	var prefix;
	var table;
	var wasSP = false;
	var prefix = '';
	var leadStatus = '';
	
	$.each([1, 2], function(idx, t) {
		prefix = 'Game.Period(' + p + ').Jam(' + j + ').Team(' + t + ')'
		id = WS.state[prefix + '.Skater(Jammer).Id'];
		if (id != null) { 
		// Add the jammer to the list and increment their "jams" count
			addJammer(t,id);
			incrementJams(t,id);
			// If the jammer earned lead, increment their "lead" count
			// This will break if the SBO uses "Lost Lead" to indicate lost opportunity for lead, like the paperwork.
			leadStatus = WS.state[prefix + '.LeadJammer']
			if (leadStatus == 'Lead' || leadStatus == 'LostLead'){
				incrementLead(t,id);
			}
			updateLeadPct(t,id);
		}
		
		
		// If there was a star pass, add the pivot to the list too
		wasSP = WS.state[prefix + '.StarPass'];
		if (wasSP){
			id = WS.state[prefix + '.Skater(Pivot).Id'];
			if (id != null){
				addJammer(t,id);
				incrementJams(t,id);
				updateLeadPct(t,id);
			}
		}
		
		// If there was no star pass, assign the points to the jammer, if there was, give them to the pivot.
		// Note that this will be inaccurate if the original jammer scored points, but there's no way to fix this
		// as the points per jammer aren't recorded.
		if (id != null) {
			updatePriorScore(t, id, p, j);
		}
	})
}

function updatePriorScore(t, id, p, j){
	// Given a skater and a jam, add the score for that jam to that skater's priorScore total
	// and update the table.
		jammerList[id].priorScore += WS.state['Game.Period(' + p +').Jam(' + j + 
			').Team(' + t + ').JamScore'];
		var scoreCell = $('.Team' +t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Pts');
		scoreCell.html(jammerList[id].priorScore);
	}

function addJammer(t, id) {
	// Given a team and Jammer ID, add them to the list if they are not present, and 
	// increment their "Jams" count if they are.
	prefix = 'ScoreBoard.Team(' + t + ').Skater(' + id + ')';
	table = $('.Team' + t + ' tbody');
	
	if (!jammerList.hasOwnProperty(id)){
	// If this is a new jammer, add them to the jammer list, and add a row to the display
		jammerList[id] = {
			name: WS.state[prefix + '.Name'],
			number: WS.state[prefix + '.Number'],
			team: t,
			priorScore: 0,
			currentScore: 0,
			lead: 0
		}
		table.append(makeJammerRow(id));
	}

}

function incrementJams(t, id) {
	// Given a team and a jammer ID, add one to their "jams" count
	var jamsCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Jams');
	var jams = parseInt(jamsCell.html()) + 1;
	jamsCell.html(jams);
}

function incrementLead(t, id) {
	// Given a team and a jammer ID, add one to their "lead" count
	var leadCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Lead');
	jammerList[id].lead += 1;
	leadCell.html(jammerList[id].lead);
}

function updateLeadPct(t, id) {
// Given a team and a jammer ID, update the lead percentage based on the current content of the table
	var leadCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Lead');
	var jamsCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Jams');
	var leadPctCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .LeadPct');
	var leadCount = parseInt(leadCell.html());
	var jamsCount = parseInt(leadCell.html());
	var leadPct = 100 * leadCount / jamsCount;
	if (!leadPct) { leadPct = 0; }
	leadPctCell.html(leadPct.toFixed(2));
}

function resetTable() {
	// Clear the table
	$.each([1, 2], function(idx, t) {
		$('.Team' + t + ' tbody').empty();
	})
}

function makeJammerRow(id) {
	// Given a jammer ID, return a row for the table
	var row = $('<tr>').addClass('Jammer').attr('data-number', jammerList[id].number);
	row.append($('<td>').addClass('Name').html(jammerList[id].name + ' (' + jammerList[id].number + ')'));
	row.append($('<td>').addClass('Jams').html(0));
	row.append($('<td>').addClass('Lead').html('0'));
	row.append($('<td>').addClass('LeadPct').html('0'));
	row.append($('<td>').addClass('Box').html('0'));
	row.append($('<td>').addClass('Pts').html('0'));
	row.append($('<td>').addClass('Dif').html('0'));
	
	return row;
}

function jamsInPeriod(p) {
// return the number of jams in period p
	var maxJams = 100 // This is absurdly high.
	
	for (var j = 1; j < maxJams; j++){
		if (WS.state['Game.Period('+ p +').Jam(' + j + ').JamLength'] == undefined){
			return j-1;
		}
	}
}

function processScoreboardColors(k, v, t){
// Given a change in overlay color, update the screen
	var overlayFg = WS.state['ScoreBoard.Team(' + t + ').Color(overlay_fg)'];
	var overlayBg = WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)'];

	if (overlayFg == null) { overlayFg == 'white'; }
	if (overlayBg == null) { overlayBg == 'black'; }

	$('.Team' + t + ' .TeamName').css('color', overlayFg); 
	$('.Team' + t + ' .TeamName').css('background-color', overlayBg);
}


/*	// Process Star Pass events
var match = k.match(starPassRE);
if (match != null && match.length != 0 && v == true){
	var p = match[1];
	var j = match[2];
	var t = match[3];
	var oldJammer = WS.state['Game.Period('+p+').Jam('+j+').Team('+t+').Skater(Jammer).Id'];
	var newJammer = WS.state['Game.Period('+p+').Jam('+j+').Team('+t+').Skater(Pivot).Id'];

	// Set the star pass flag
	starPass[t] = true;
	
	// Add the current points for the old jammer to their prior points
	jammerList[oldJammer].priorScore += jammerList[oldJammer].currentScore;
	spOffset[t] = jammerList[oldJammer].currentScore;
	jammerList[oldJammer].currentScore = 0;
	
	// Add the pivot to the skater list if not present
	if (newJammer != null && newJammer != undefined){
		addJammer(t, newJammer);
	}
}

*/

// Maybe come back to use this stuff.
/*
var prefix = '';
var t = '';
var teamTable;


// If this is a jammer, add them to the list
var match = k.match(jammerRegexp);
if (match != null && v != null){
	t = match[1];
	teamTable = $('.Team' + t + ' tbody');
	prefix = 'ScoreBoard.Team(' + t + ').Skater(' + v + ')';

	if (!jammerList.hasOwnProperty(v)){
	// If this is a new jammer, add them to the jammer list, and add a row to the display
		jammerList[v] = {
			name: WS.state[prefix + '.Name'],
			number: WS.state[prefix + '.Number'],
			team: t
		}
		console.log(jammerList);
		teamTable.append(makeJammerRow(v));
	}
	
	var jammerRow = teamTable.find('tr').filter(function() {return $(this).data('number') == jammerList[v].number})
	console.log(WS.state['Game.Period(' + period + ').Jam(' + jam + ').JamLength']);
	if (WS.state['Game.Period(' + period + ').Jam(' + jam + ').JamLength'] == '0:00') {
		console.log('here');
		jammerRow.find('td.Jams').html(+jammerRow.find('td.Jams').html() + 1);
	}
	
	}
	*/