$(initialize);

var period = null;
var jam = null;
var jammerList = {};

function initialize() {
	jammerList = {};
	
	WS.Connect();
	WS.AutoRegister();

	$.each([1, 2], function(idx, t) {
		WS.Register([ 'ScoreBoard.Team(' + t + ').Name' ]); 
		WS.Register([ 'ScoreBoard.Team(' + t + ').AlternateName' ]);
		WS.Register([ 'ScoreBoard.Team(' + t + ').Color' ], function(k, v) { 
			$('.Team' + t + 'custColor').css('color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_fg)']); 
			$('.Team' + t + 'custColor').css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); 
			$('#head' + t).css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); } );
		
		WS.Register([ 'ScoreBoard.Team(' + t + ').JamScore' ], function(k,v) {
			currentJamScore(k,v,t);
		})
		
	});
	
	WS.Register( [ 'ScoreBoard.Clock(Period).Number' ], function(k, v) { period = v; });
	WS.Register( [ 'ScoreBoard.Clock(Jam).Number' ], function(k, v) { 
		jam = v;
		newJam(period, jam);
	});

	WS.Register( [ 'ScoreBoard.Team(1).Skater' ]); 
	WS.Register( [ 'ScoreBoard.Team(2).Skater' ]); 
	WS.Register( [ 'ScoreBoard.Team(1).Position(Jammer)']);
	WS.Register( [ 'ScoreBoard.Team(2).Position(Jammer)']);

	WS.Register( [ 'Game' ], function(k,v){
		processEvent(k,v);
	})
	

}

function currentJamScore(k, v, t){
// For a "jam score" event for the current jam:
	console.log(k, v, t)
	// Find the ID for the jammer for the current jam
	var id = WS.state['ScoreBoard.Team('+t+').Position(Jammer).Skater'];
	if (id == null || id == undefined) { return; }

	// Move the current jam score to "current jam" for the jammer.
	jammerList[id].currentScore = v;
	
	var scoreCell = $('.Team' +t + ' tbody tr.Jammer[data-number=' + 
			jammerList[id].number + '] .Pts');
	scoreCell.html(jammerList[id].priorScore + jammerList[id].currentScore);
	
}

function newJam(period, jam) {
	var id = '';
	var priorJam = 0;
	var priorJammer = '';
	
	
	//TODO account for start of period 2
	$.each([1,2], function(idx, t) {
		priorJam = jam - 1;
		priorJammer = WS.state['Game.Period(' + period + ').Jam(' + priorJam + ').Team(' + t + ').Skater(Jammer).Id'];
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


var jammerRegexp = /Game\.Period\(\d\)\.Jam\(\d\)\.Team\((\d)\)\.Skater\(Jammer\)\.Id/;

function processEvent(k, v) { 
	
	console.log(k,v);
		
	if (k == 'Game.Period(1).Jam(1).PeriodClockStart'){
	// This will trigger *either* at the start of the game, OR if the scoreboard is reloaded.
		jammerList = {};
		resetTable();
		
		// Add jammers for prior periods
		var currentJam = WS.state['ScoreBoard.Clock(Jam).Number']
		var currentPeriod = WS.state['ScoreBoard.Clock(Period).Number']
		if (currentPeriod == 2){
		// If this is the second period, add all the jammers for the first period
			var j = 1;
			while (WS.state['Game.Period(1).Jam(' + j + ').Jam'] != undefined){
				addPriorJammers(1,j);
				j++;
			}			
		}
		for (var j = 1; j <= currentJam; j++){
		// Add all the prior jammers for the current period
			addPriorJammers(currentPeriod, j);
		}
	}
	
	
	return;
	
}

function addPriorJammers(p,j) {
// Given a period and a jam number, add both jammers to the list if they 
// are entered and not in the list.  Also update statistics.  This is for jammers prior to
// the current jam
	
	var id;
	var prefix;
	var table;
	
	$.each([1, 2], function(idx, t) {
		id = WS.state['Game.Period(' + p + ').Jam(' + j + ').Team(' + t + ').Skater(Jammer).Id'];
		if (id == null) { return; }
		
		// Add the jammer to the list
		addJammer(t,id);
		updatePriorScore(t,id, p, j);
		
	})
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
			currentScore: 0
		}
		table.append(makeJammerRow(id));
	} else {
		var jamsCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Jams')
		var jams = parseInt(jamsCell.html()) + 1;
		jamsCell.html(jams);
	}
}

function updatePriorScore(t, id, p, j){
// Given a skater and a jam, add the score for that jam to that skater's priorScore total.
	jammerList[id].priorScore += WS.state['Game.Period(' + p +').Jam(' + j + 
		').Team(' + t + ').JamScore'];
	var scoreCell = $('.Team' +t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Pts');
	scoreCell.html(jammerList[id].priorScore);
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
	row.append($('<td>').addClass('Jams').html(1));
	row.append($('<td>').addClass('Lead').html('0'));
	row.append($('<td>').addClass('LeadPct').html('0'));
	row.append($('<td>').addClass('Box').html('0'));
	row.append($('<td>').addClass('Pts').html('0'));
	row.append($('<td>').addClass('Dif').html('0'));
	
	return row;
}


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