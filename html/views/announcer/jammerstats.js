$(initialize);

var period = null;
var jam = null;
var jammerList = {};
var starPass = {1: false, 2: false};
var spOffset = {1: 0, 2: 0};
var lead = {1: false, 2: false};

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
		
		WS.Register( [ 'ScoreBoard.Team(' + t + ').Skater' ], function(k, v){
			processPenalty(k,v,t);
		} ); 
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
	var jamScore = v;
	var oppJamScore = WS.state['ScoreBoard.Team(' + (t%2 + 1) + ').JamScore']
	
	// console.log(k, v, t)
	// Find the ID for the jammer for the current jam
	if(starPass[t] == false) {
		id = WS.state[prefix + '.Skater(Jammer).Id'];
	} else {
		id = WS.state[prefix + '.Skater(Pivot).Id'];
	}
	if (id != null && id != undefined && jammerList[id] != undefined) { 
		// Move the current jam score to "current jam" for the jammer.
		jammerList[id].currentScore = jamScore - spOffset[t];
		jammerList[id].currentDif = jamScore - oppJamScore - spOffset[t];
		
		// Update the Score Cell
		var scoreCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + 
				jammerList[id].number + '] .Pts');
		scoreCell.html(jammerList[id].priorScore + jammerList[id].currentScore);
		
		// Update the Dif Cell
		var difCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' +
				jammerList[id].number + '] .Dif');
		difCell.html(jammerList[id].priorDif + jammerList[id].currentDif);	
	}
	
	// Find the ID for the opposing jammer
	if(starPass[t%2 + 1] == false){
		id = WS.state['Game.Period(' + period + ').Jam(' + jam + ').Team(' + (t%2 + 1) + ').Skater(Jammer).Id'];
	} else {
		id = WS.state['Game.Period(' + period + ').Jam(' + jam + ').Team(' + (t%2 + 1) + ').Skater(Pivot).Id'];
	}
	if (id != null && id != undefined && jammerList[id] != undefined) {
		jammerList[id].currentDif = oppJamScore - jamScore - spOffset[t%2 + 1];
		
		var difCell = $('.Team' + (t%2 + 1) + ' tbody tr.Jammer[data-number=' + 
				jammerList[id].number + '] .Dif');
		difCell.html(jammerList[id].priorDif + jammerList[id].currentDif);
	}
	
	
}

function processCurrentJamLead(k, v, t){
// For a "Lead" event for the current jam, increment the counter for the current jammer
	//console.log(k,v,t)
	var id = WS.state['ScoreBoard.Team(' + t + ').Position(Jammer).Skater']
	if (id==undefined){ return; } // can't do anything if no jammer is entered
								  // Also resolves the "nolead" issued at the end of a jam

	if (v == "Lead") { 
		jammerList[id].lead += 1;
		lead[t] = true;
	} else if (v == "NoLead" && lead[t] == true) {
		jammerList[id].lead -= 1;
	}
	var leadCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + 
			jammerList[id].number + '] .Lead');
	leadCell.html(jammerList[id].lead);
	updateLeadPct(t, id);
}


function processCurrentJamStarPass(k, v, t){
// For a star pass event for the current jam
	if (v == false || v == null) { return; }
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
	
	// Update the dif
	jammerList[oldJammer].priorDif += jammerList[oldJammer].currentDif;
	jammerList[oldJammer].currentDif = 0;
	
	// Add the pivot to the skater list if not present
	if (newJammer != null && newJammer != undefined){
		addJammer(t, newJammer);
		incrementJams(t, newJammer);
		updateLeadPct(t, id);
	}
	
}

var penaltyRE = /ScoreBoard\.Team\(\d\)\.Skater\((\S+)\)\.Penalty\(\d\).Id/;
function processPenalty(k,v,t){
	var match = k.match(penaltyRE);
	if (match == null || match.length == 0) { return; }
	var id = match[1];
	
	updatePenaltyCount(t,id);

}

function newJam(period, jam) {
// Trigger at the start of a new jam
	var id = '';
	var priorJam = 0;
	var priorJammer = '';
	starPass = {1: false, 2: false};
	spOffset = {1: 0 , 2: 0 };
	lead = {1: false, 2: false};
	
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
		jammerList[priorJammer].priorDif += jammerList[priorJammer].currentDif;
		jammerList[priorJammer].currentDif = 0;
	})
	
	
	// Add the current jammer to the list.
	$.each([1, 2], function(idx, t) {
		id = WS.state['ScoreBoard.Team(' + t + ').Position(Jammer).Skater'];
		if (id == null) { return; }
		addJammer(t,id);
		incrementJams(t,id);
		updateLeadPct(t,id);
	})

}

function processGameEvent(k, v) { 
	// Game events should be used to recreate the data in the event the screen is reloaded, or loaded after
	// the game starts.
	
	//console.log(k,v);
		
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
		for (var j = 1; j < currentJam; j++){
		// Add all the prior jammers for the current period
			processPriorJam(currentPeriod, j);
		}
		// Update the information for the current jam, without points
		$.each([1,2], function(idx,t) {
			prefix = 'Game.Period(' + currentPeriod + ').Jam(' + currentJam + ').Team(' + t + ')';
			id = WS.state[prefix + '.Skater(Jammer).Id'];
			if (id != null){
				addJammer(t, id);
				incrementJams(t, id);
			}
			updateLeadPcts('.Team' + t);
		})
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
		prefix = 'Game.Period(' + p + ').Jam(' + j + ').Team(' + t + ')';
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
			updatePenaltyCount(t, id);
		}
		
		
		// If there was a star pass, add the pivot to the list too
		wasSP = WS.state[prefix + '.StarPass'];
		if (wasSP){
			id = WS.state[prefix + '.Skater(Pivot).Id'];
			if (id != null){
				addJammer(t,id);
				incrementJams(t,id);
				updateLeadPct(t,id);
				updatePenaltyCount(t,id);
			}
		}
		
		// If there was no star pass, assign the points to the jammer, if there was, give them to the pivot.
		// Note that this will be inaccurate if the original jammer scored points, but there's no way to fix this
		// as the points per jammer aren't recorded.
		if (id != null) {
			updatePriorScore(t, id, p, j);
			updateLeadPct(t, id);
		}
	})
}

function updatePriorScore(t, id, p, j){
// Given a skater and a jam, add the score for that jam to that skater's priorScore total
// and update the table.
	var jamScore = WS.state['Game.Period(' + p +').Jam(' + j + ').Team(' + t + ').JamScore'];
	jammerList[id].priorScore += jamScore;
	var scoreCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Pts');
	scoreCell.html(jammerList[id].priorScore);
	
	// Update the score difference column
	var difCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + jammerList[id].number + '] .Dif');
	var oppJamScore = WS.state['Game.Period(' + p + ').Jam(' + j + ').Team(' + (t%2 + 1) + ').JamScore'];
	jammerList[id].priorDif = jammerList[id].priorDif + jamScore - oppJamScore;
	difCell.html(jammerList[id].priorDif);
	
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
			lead: 0,
			cuurentDif: 0,
			priorDif: 0
		}
		table.append(makeJammerRow(id));
		sortTableByNumber('.Team' + t);
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
	var leadPct = 0;
	if (jamsCount > 0 && leadCount > 0){
		leadPct = 100 * leadCount / jamsCount;
	}
	leadPctCell.html(leadPct.toFixed(0));
}

function updatePenaltyCount(t,id) {
	if (id == undefined || !jammerList.hasOwnProperty(id)) { return; }

	var penaltyCell = $('.Team' + t + ' tbody tr.Jammer[data-number=' + 
			jammerList[id].number + '] .Box');
	penaltyCell.html(nPenalties(t,id));
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

function nPenalties(t, id) {
// Given a team and skater ID, get the number of penalties presently in the state.
	var prefix = 'ScoreBoard.Team(' + t + ').Skater(' + id + ').Penalty(';
	var nPenalties = 0;
	var code = '';
	
	for (var n=1; n < 10; n++){
		code = WS.state[prefix + n + ').Code']
		if (code == undefined){
			return nPenalties;
		} else if (code != 'FO_EXP'){
			nPenalties += 1
		}
	}
	
	return nPenalties;
}


function sortTableByNumber(tableName) {
    var row, rowNumber;
    var comparisonRow, comparisonNumber;

    $(tableName + " tr.Jammer").each(function(i) {
        row = $(tableName + " tr.Jammer:eq(" + i + ")");
        rowNumber = row.attr('data-number');

        $(tableName + " tr.Jammer").each(function(j) {
            comparisonRow = $(tableName + " tr.Jammer:eq(" + j + ")");
            comparisonNumber = comparisonRow.attr('data-number');

            if ( rowNumber < comparisonNumber ) {
                $(row).insertBefore(comparisonRow);
                return false;
            }
        });
    });
};


function updateLeadPcts(tableName) {
	var row;
	var leadCell, jamsCell, leadPctCell;
	var leadCount, jamsCount;
	var leadPct;
	
	$(tableName + " tr.Jammer").each(function(i) {
		leadPct = 0;
		row = tableName + " tr.Jammer:eq(" + i + ")";
		leadCell = $(row + " td.Lead");
		jamsCell = $(row + " td.Jams");
		leadPctCell = $(row + " td.LeadPct");
		leadCount = parseInt(leadCell.html());
		jamsCount = parseInt(jamsCell.html());
		if (jamsCount > 0 && leadCount > 0){
			leadPct = 100 * leadCount / jamsCount;
		}
		leadPctCell.html(leadPct.toFixed(0));
	})
}