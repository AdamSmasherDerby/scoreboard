$(initialize("1")); //TODO make this an input parameter, not a fixed "team 1"
/**
 * This file is part of the Carolina Rollergirls (CRG) ScoreBoard.
 * The CRG ScoreBoard is licensed under either the GNU General Public
 * License version 3 (or later), or the Apache License 2.0, at your option.
 * See the file COPYING for details.
 */
var lineups = {};
var penalties = {};
var skaterNumbers = {};
var penaltyEditor = null;

function initialize(t) {
	WS.Connect();
	WS.AutoRegister();
	
	WS.Register([ 'ScoreBoard.Team(' + t + ').Name' ], function(k,v) {
		$('#tableDiv table.Team' + t +' th.Team a.Team').html(v);
	});
	
	WS.Register(['ScoreBoard.Stats'], function(k,v) {
		// Add skaters to the lineups table as they come in.
		processStats(k,v,t);
	});
	
	WS.Register(['ScoreBoard.Team('+t+').Skater'], function(k,v) {
		skaterUpdate(1, k, v);
	});
	
	WS.Register(['ScoreBoard.Team('+t+').Position'], function(k,v) {
		updateEntryTable(t,k,v)
	});
	
	WS.Register(['ScoreBoard.Clock']);
	WS.Register(['ScoreBoard.Clock(Jam).Running'] , function(k, v) {
		makePriorJamTable(t);
		updateEntryTable(t);
	});
	
	penaltyEditor = $('div.PenaltyEditor').dialog({
		modal: true,
		closeOnEscape: false,
		title: 'Penalty Editor',
		autoOpen: false,
		width: '80%',
	});
	
	$(".PenaltyEditor .period_minus").click(function () { adjust("Period", -1); });
	$(".PenaltyEditor .period_plus").click(function () { adjust("Period", 1); });
	$(".PenaltyEditor .jam_minus").click(function () { adjust("Jam", -1); });
	$(".PenaltyEditor .jam_plus").click(function () { adjust("Jam", 1); });
	$(".PenaltyEditor .clear").click(function () { clear(); });
	
	$("")
}


var skaterIdRegex = /Skater\(([^\)]+)\)/;
var penaltyRegex = /Penalty\(([^\)]+)\)/;
function skaterUpdate(t, k, v){
	
	
	
	var match = (k || "").match(skaterIdRegex);
	if (match == null || match.length == 0)
		return;
	
	var id = match[1];
	//TODO - handle changed skater numbers 
	
	match = k.match(penaltyRegex);
	if (match == null || match.length == 0)
		return;
	
	var field = k.split('.').pop();
	if ( field === 'Code') {
		// p is the penalty number for the skater
		var p = match[1];
		var code = v;
		var period = WS.state['ScoreBoard.Team('+t+').Skater('+id+').Penalty('+p+').Period'];
		var jam = WS.state['ScoreBoard.Team('+t+').Skater('+id+').Penalty('+p+').Jam'];
		jam = ( jam == 0 ? 1 : jam );
		if (!penalties.hasOwnProperty(period)) {penalties[period] = {}};
		if (!penalties[period].hasOwnProperty(jam)) {penalties[period][jam] = {}};
		if (!penalties[period][jam].hasOwnProperty(id)) {penalties[period][jam][id] = []}
		penalties[period][jam][id].push(code);
		refreshPenalties(t,id);
	}
	
}


function adjust(which, inc) {
	var elem = $(".PenaltyEditor ." + which);
	elem.val(parseInt(elem.val()) + inc);
}

function clear() {
	if (penaltyId == null || skaterId == null) {
		penaltyEditor.dialog("close");
	} else {
		var fo_exp = penaltyType === 'FO_EXP';
		WS.Command("Penalty", { teamId: teamId, skaterId: skaterId, penaltyId: penaltyId, fo_exp: fo_exp, jam: 0, period: 0 });
		penaltyEditor.dialog('close');
	}
}

var positionRE = /ScoreBoard\.Team\((\d)\)\.Position\((\w+)\).Skater/
function updateEntryTable(t,k,id) {
	// Given updated skater info for the current jam,
	// update PL entry table for current jam.
	
	// Update header with period and jam number
	var period = WS.state['ScoreBoard.Clock(Period).Number'];
	var jam = WS.state['ScoreBoard.Clock(Jam).Number'];
	$('#entryDiv table.Team' + t + ' th.Jam a.Jam').html('Period ' + period + ' - Jam ' + jam);
	
	if (k == undefined) {return}
	
	var match = k.match(positionRE);
	if (match == null || match.length == 0) { return; }
	var position = match[2].toLowerCase();
	var row = '#entryDiv table.Team' + t + ' tr.' + position + 'Row';
	$(row +' td.Number a.Number').html(getNumber(t,id));
	refreshPenalties(t,position,id);
}

function refreshPenalties(t,id){
	// Given a team, and a skater ID, refresh the penalties
	// for that row and skater in the entry table
	var period = WS.state['ScoreBoard.Clock(Period).Number'];
	var jam = WS.state['ScoreBoard.Clock(Jam).Number'];
	var position = WS.state['ScoreBoard.Stats.Period('+ period + ').Jam('+
		jam+').Team('+t+').Skater('+id+').Position'];
	
	if (!position) {
		return
		} else {
			position = position.toLowerCase();
		}
	
	var row = '#entryDiv table.Team' + t + ' tr.' + position + 'Row';
	if (penalties.hasOwnProperty(period) &&
			penalties[period].hasOwnProperty(jam) &&
			penalties[period][jam].hasOwnProperty(id)){
		var plist = penalties[period][jam][id]
		for(p = 1; p <= plist.length; p++){
			$(row + ' td.penalty' + p).html(plist[p]);
		}
	}
}

var skaterRE = /ScoreBoard\.Stats\.Period\((\d)\)\.Jam\((\d+)\)\.Team\((\d)\)\.Skater\((\S+)\)\.Position/
function processStats(k,v,t) {
	
	// If this is a skater, add it to an array of all 
	// skaters who have lined up during the game.
	
	var match = k.match(skaterRE);
	if (match == null || match.length == 0 || match[3] != t) { return; }
	var period = match[1];
	var jam = match[2];
	var id = match[4];
	var number = getNumber(t,id);
	
	// For each skater declaration, add them to the "lineups" array.
	if (!lineups.hasOwnProperty(period)) {lineups[period] = {}};
	if (!lineups[period].hasOwnProperty(jam)) {lineups[period][jam] = {}};
	lineups[period][jam][v] = id;
	if (!skaterNumbers.hasOwnProperty(number)) {skaterNumbers[number] = {id: id}}
}

function makePriorJamTable(t) {
	// Make the HMTL table for every lineup prior to the current one
	
	var period = WS.state['ScoreBoard.Clock(Period).Number'];
	var jam = WS.state['ScoreBoard.Clock(Jam).Number'];
	var table = $('#tableDiv table.Team' + t);
	var row;
	
	for(var p = 1; p <= period; p++) {
		for(var j = 1; j < jam; j++) {
			if (document.getElementById('Period'+p+'Jam'+j)){
				row = table.find('#Period'+p+'Jam'+j)
			} else {
				row = table.find('tr.Template').clone().removeClass('Template')
					.attr('id','Period'+p+'Jam'+j).appendTo(table);
			}
			row.find('td.Period a.Period').html(p)
			row.find('td.Jam a.Jam').html(j);
			row.find('td.Jammer a.Jammer').html(getLineupNumber(t,p,j,'Jammer'));
			row.find('td.Pivot a.Pivot').html(getLineupNumber(t,p,j,'Pivot'));
			row.find('td.Blocker1 a.Blocker1').html(getLineupNumber(t,p,j,'Blocker1'));
			row.find('td.Blocker2 a.Blocker2').html(getLineupNumber(t,p,j,'Blocker2'));
			row.find('td.Blocker3 a.Blocker3').html(getLineupNumber(t,p,j,'Blocker3'));

		}
	}
	
}

function getLineupNumber(t,p,j,position){
	if (lineups.hasOwnProperty(p) &&
			lineups[p].hasOwnProperty(j) &&
			lineups[p][j].hasOwnProperty(position)){
		return getNumber(t,lineups[p][j][position]);
	} else {
		return '';
	}
}

function getNumber(t,id) {
	var number = WS.state['ScoreBoard.Team('+t+').Skater('+id+').Number'];
	return (number ? number : "");
}

//# sourceURL=controls\plt.js