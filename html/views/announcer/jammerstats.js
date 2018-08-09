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
			// Find the ID for the jammer for the current jam
			// If ID is not null:
				// Move the current jam score to "current jam" for the jammer.
				// Update display with current jam + prior score
			console.log('k: ', k, ' v: ',v);
		})
		
	});
	
	WS.Register( [ 'ScoreBoard.Clock(Period).Number' ], function(k, v) { period = v; });
	WS.Register( [ 'ScoreBoard.Clock(Jam).Number' ], function(k, v) { jam = v;});

	WS.Register( [ 'ScoreBoard.Team(1).Skater' ]); 
	WS.Register( [ 'ScoreBoard.Team(2).Skater' ]); 

	WS.Register( [ 'Game' ], function(k,v){
		processEvent(k,v);
	})
	

}


function priorJamScore(k, v) {
	// For a "jam score" event for a prior jam:
	// If the jammer is entered for the jam:
		// Add them to the list if they do not exist.
		// Add the score to their "prior total" points.
		// Update display
}

function newJam(k, v) {
	// Add the "current jam" score for the two prior jammers to their "prior total" points
	// Clear the "current jam" score for the two prior jammers.	
	// Add the new jammers to the list if they are not present.

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
				addJammers(1,j);
				j++;
			}			
		}
		for (var j = 1; j <= currentJam; j++){
		// Add all the jammers for the current period
			addJammers(currentPeriod, j);
		}
	}
	
	
	return;
	
}

function addJammers(p,j) {
// Given a period and a jam number, add both jammers to the list if they are entered and not in the list
	
	var id;
	var prefix;
	var table;
	
	$.each([1, 2], function(idx, t) {
		id = WS.state['Game.Period(' + p + ').Jam(' + j + ').Team(' + t + ').Skater(Jammer).Id'];
		if (id == null) { return; }
		
		prefix = 'ScoreBoard.Team(' + t + ').Skater(' + id + ')';
		table = $('.Team' + t + ' tbody');
		
		if (!jammerList.hasOwnProperty(id)){
		// If this is a new jammer, add them to the jammer list, and add a row to the display
			jammerList[id] = {
				name: WS.state[prefix + '.Name'],
				number: WS.state[prefix + '.Number'],
				team: t
			}
			table.append(makeJammerRow(id));
		} else {
			var jamsCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Jams')
			var jams = parseInt(jamsCell.html()) + 1;
			jamsCell.html(jams);
		}
	})
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